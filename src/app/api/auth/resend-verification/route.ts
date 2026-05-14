export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mail";

const CODE_TTL_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  // Return success regardless of whether the user exists — avoids user enumeration
  if (!user || user.emailVerified) {
    return NextResponse.json({ success: true });
  }

  const code    = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + CODE_TTL_MS);

  await prisma.emailVerificationCode.deleteMany({ where: { email } });
  await prisma.emailVerificationCode.create({ data: { email, code, expires } });
  await sendVerificationEmail(email, code);

  return NextResponse.json({ success: true });
}
