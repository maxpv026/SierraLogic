import type { NextAuthOptions } from "next-auth";
import GoogleProvider      from "next-auth/providers/google";
import AppleProvider       from "next-auth/providers/apple";
import EmailProvider       from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter }   from "@auth/prisma-adapter";
import bcrypt              from "bcrypt";
import { verify as verifyTOTP } from "otplib";
import { prisma }          from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    AppleProvider({
      clientId:     process.env.APPLE_ID     ?? "",
      clientSecret: process.env.APPLE_SECRET ?? "",
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST ?? "",
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER     ?? "",
          pass: process.env.EMAIL_SERVER_PASSWORD ?? "",
        },
      },
      from: process.env.EMAIL_FROM ?? "noreply@sierralogic.ai",
    }),
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
        totp:     { label: "2FA Code", type: "text"     }, // optional; required only when 2FA is enabled
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
          select: {
            id:                 true,
            email:              true,
            name:               true,
            image:              true,
            password:           true,
            emailVerified:      true,
            isTwoFactorEnabled: true,
            twoFactorSecret:    true,
          },
        });

        // No user, or user registered via OAuth (no password)
        if (!user?.password) return null;

        const passwordOk = await bcrypt.compare(credentials.password, user.password);
        if (!passwordOk) return null;

        // Block sign-in for accounts that haven't verified their email yet
        if (!user.emailVerified) throw new Error("EmailNotVerified");

        // ── 2FA check ────────────────────────────────────────────────────────
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
          const totp = (credentials as Record<string, string | undefined>).totp?.trim();
          if (!totp) return null; // code missing — login UI must provide it

          const totpOk = await verifyTOTP({ secret: user.twoFactorSecret, token: totp });
          if (!totpOk) return null;
        }

        // Never expose password hash or 2FA secret in the token
        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          image: user.image,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },
  pages:   { signIn: "/login" },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // First sign-in: hydrate token with DB fields not returned by authorize()
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where:  { id: user.id as string },
          select: { language: true, plan: true },
        });
        token.language = dbUser?.language ?? "en";
        token.plan     = dbUser?.plan     ?? "FREE";
      }

      // Manual session update (e.g. profile save, language change, plan upgrade)
      if (trigger === "update" && session) {
        if (typeof session.name     === "string")                           token.name     = session.name;
        if (typeof session.image    === "string" || session.image === null) token.picture  = session.image as string | null;
        if (typeof session.language === "string")                           token.language = session.language;
        if (typeof session.plan     === "string")                           token.plan     = session.plan;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        const u = session.user as { id?: string; language?: string; plan?: string };
        u.id       = token.sub;
        u.language = (token.language as string | undefined) ?? "en";
        u.plan     = (token.plan     as string | undefined) ?? "FREE";
      }
      return session;
    },
  },
};
