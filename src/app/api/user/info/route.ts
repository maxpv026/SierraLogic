export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, type PlanKey } from "@/lib/stripe";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [user, accounts, usageThisMonth, totalAnalyses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true, email: true, image: true, jobTitle: true, company: true,
        createdAt: true, isTwoFactorEnabled: true,
        plan: true, stripeCustomerId: true, stripeSubscriptionId: true,
        stripePriceId: true, stripeCurrentPeriodEnd: true,
      },
    }),
    prisma.account.findMany({ where: { userId }, select: { provider: true } }),
    prisma.analysisResult.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    prisma.analysisResult.count({ where: { userId } }),
  ]);

  const plan = (user?.plan ?? "FREE") as PlanKey;
  const planMeta = PLANS[plan] ?? PLANS.FREE;
  const monthlyLimit = planMeta.analysesPerMonth === Infinity ? null : planMeta.analysesPerMonth;

  return NextResponse.json({
    success: true,
    data: {
      user,
      providers: accounts.map((a) => a.provider),
      usageThisMonth,
      totalAnalyses,
      monthlyLimit,   // null means unlimited (MAX plan)
      plan,
      planName: planMeta.name,
    },
  });
}
