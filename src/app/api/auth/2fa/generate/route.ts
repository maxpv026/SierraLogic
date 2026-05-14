export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isTwoFactorEnabled: true },
  });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  if (user.isTwoFactorEnabled) {
    return NextResponse.json({ success: false, error: "2FA is already enabled" }, { status: 409 });
  }

  // Generate a fresh TOTP secret — not saved to DB until the user verifies a code
  const secret = generateSecret();
  const otpauthUrl = generateURI({ label: user.email ?? userId, issuer: "SierraLogic", secret });
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ success: true, data: { secret, qrCode } });
}
