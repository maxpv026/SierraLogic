import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id:        string;
      language?: string;
      plan?:     string;   // "FREE" | "PRO" | "MAX"
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    language?: string;
    plan?:     string;
  }
}
