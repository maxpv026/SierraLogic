export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verify as verifyTOTP } from "otplib";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  const token  = typeof body.token  === "string" ? body.token.trim()  : "";

  if (!secret || !token) {
    return NextResponse.json({ success: false, error: "secret and token are required" }, { status: 400 });
  }

  // Verify the token matches the provided secret
  const isValid = await verifyTOTP({ secret, token });
  if (!isValid) {
    return NextResponse.json({ success: false, error: "Invalid verification code." }, { status: 400 });
  }

  // Persist the secret and enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret, isTwoFactorEnabled: true },
  });

  return NextResponse.json({ success: true });
}
