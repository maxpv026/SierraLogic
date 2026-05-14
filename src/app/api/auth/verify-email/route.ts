export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code  = typeof body.code  === "string" ? body.code.trim()               : "";

  if (!email || !code) {
    return NextResponse.json({ success: false, error: "email and code are required." }, { status: 400 });
  }

  // Look up the most-recent code for this address
  const record = await prisma.emailVerificationCode.findFirst({
    where: { email },
    orderBy: { expires: "desc" },
  });

  if (!record) {
    return NextResponse.json({ success: false, error: "No verification code found. Request a new one." }, { status: 400 });
  }

  if (record.code !== code) {
    return NextResponse.json({ success: false, error: "Incorrect code. Please try again." }, { status: 400 });
  }

  if (record.expires < new Date()) {
    return NextResponse.json({ success: false, error: "Code has expired. Request a new one." }, { status: 400 });
  }

  // Mark email as verified and clean up the code in one transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data:  { emailVerified: new Date() },
    }),
    prisma.emailVerificationCode.deleteMany({ where: { email } }),
  ]);

  return NextResponse.json({ success: true });
}
