export const runtime = "nodejs";

// Pre-flight check: validates email + password WITHOUT creating a session.
// The login UI uses this to determine whether to show the 2FA input step
// before calling NextAuth signIn().

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ valid: false }); }

  const email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password                  : "";

  if (!email || !password) return NextResponse.json({ valid: false });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { password: true, emailVerified: true, isTwoFactorEnabled: true },
  });

  // Same response for "user not found" and "wrong password" — no user enumeration
  if (!user?.password) return NextResponse.json({ valid: false });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return NextResponse.json({ valid: false });

  // Surface email-not-verified so the UI can redirect to the OTP step
  if (!user.emailVerified) {
    return NextResponse.json({ valid: false, reason: "email_not_verified" });
  }

  return NextResponse.json({
    valid: true,
    requires2FA: user.isTwoFactorEnabled,
  });
}
