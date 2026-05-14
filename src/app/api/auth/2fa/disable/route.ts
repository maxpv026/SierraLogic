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

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ success: false, error: "Current 2FA code required to disable." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, isTwoFactorEnabled: true },
  });

  if (!user?.isTwoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ success: false, error: "2FA is not enabled." }, { status: 409 });
  }

  const isValid = await verifyTOTP({ secret: user.twoFactorSecret, token });
  if (!isValid) {
    return NextResponse.json({ success: false, error: "Invalid code. 2FA was not disabled." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: null, isTwoFactorEnabled: false },
  });

  return NextResponse.json({ success: true });
}
