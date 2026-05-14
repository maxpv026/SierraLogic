export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }           from "next-auth";
import { authOptions }                from "@/lib/auth";
import { stripe, PLANS }              from "@/lib/stripe";
import { prisma }                     from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { priceId?: unknown; plan?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Accept either a direct priceId or a plan name (PRO / MAX) — plan is preferred
  // so the client never needs to know the Stripe price ID.
  let priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
  if (!priceId && typeof body.plan === "string") {
    const planKey = body.plan.toUpperCase() as keyof typeof PLANS;
    priceId = PLANS[planKey]?.priceId ?? "";
  }
  if (!priceId) {
    return NextResponse.json({ error: "priceId or plan is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Re-use existing Stripe customer or let Stripe create one via checkout
  const customerParam = user.stripeCustomerId
    ? { customer: user.stripeCustomerId }
    : { customer_email: user.email ?? undefined };

  const checkoutSession = await stripe.checkout.sessions.create({
    mode:    "subscription",
    ...customerParam,
    line_items: [{ price: priceId, quantity: 1 }],
    // Attach userId so the webhook can find the right DB record
    client_reference_id: userId,
    metadata:            { userId },
    subscription_data:   { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${BASE_URL}/settings?tab=ai-usage&success=true`,
    cancel_url:  `${BASE_URL}/settings?tab=ai-usage&canceled=true`,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
