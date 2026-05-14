export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mail";

const MIN_PASSWORD_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 }); }

  // ── Validate inputs ────────────────────────────────────────────────────────
  const email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password                  : "";
  const name     = typeof body.name     === "string" ? body.name.trim()               : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
  }

  // ── Handle existing accounts ───────────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, password: true },
  });

  if (existing) {
    if (existing.emailVerified) {
      // Fully verified — reject
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    // Unverified leftover: resend a fresh code (no need to recreate the user)
    await issueAndSendCode(email);
    return NextResponse.json(
      { success: true, requiresEmailVerification: true, email },
      { status: 201 },
    );
  }

  // ── Create user (emailVerified stays null until OTP confirmed) ─────────────
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, name, password: hashed } });

  await issueAndSendCode(email);

  return NextResponse.json(
    { success: true, requiresEmailVerification: true, email },
    { status: 201 },
  );
}

// ── Helper: generate code, persist it, send email ─────────────────────────────

async function issueAndSendCode(email: string) {
  const code    = String(randomInt(100000, 1000000)); // cryptographically random 6-digit
  const expires = new Date(Date.now() + CODE_TTL_MS);

  // Replace any existing codes for this address
  await prisma.emailVerificationCode.deleteMany({ where: { email } });
  await prisma.emailVerificationCode.create({ data: { email, code, expires } });

  await sendVerificationEmail(email, code);
}
