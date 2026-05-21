export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }           from "next-auth";
import { authOptions }                from "@/lib/auth";
import { stripe, PLANS }              from "@/lib/stripe";
import { prisma }                     from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  // Guard: catch missing env vars early and return JSON (not an HTML crash page)
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[STRIPE_CHECKOUT_ERROR] STRIPE_SECRET_KEY is not set");
    return NextResponse.json({ error: "Stripe is not configured on this server" }, { status: 500 });
  }

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
    const planName = typeof body.plan === "string" ? body.plan.toUpperCase() : "(none)";
    console.error(`[STRIPE_CHECKOUT_ERROR] No priceId resolved — plan: ${planName}. Check STRIPE_PRO_PRICE_ID / STRIPE_MAX_PRICE_ID env vars.`);
    return NextResponse.json(
      { error: `No Stripe price configured for plan "${planName}". Check STRIPE_PRO_PRICE_ID / STRIPE_MAX_PRICE_ID.` },
      { status: 400 },
    );
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

  console.log(`[stripe/checkout] Creating session — userId: ${userId}, priceId: ${priceId}`);

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode:    "subscription",
      ...customerParam,
      line_items: [{ price: priceId, quantity: 1 }],
      // Attach userId so the webhook can find the right DB record
      client_reference_id: userId,
      metadata:            { userId },
      subscription_data:   { metadata: { userId } },
      allow_promotion_codes: true,
      // {CHECKOUT_SESSION_ID} is a Stripe template literal — replaced with the
      // real session ID before the redirect, so the sync endpoint can retrieve it.
      success_url: `${BASE_URL}/settings?tab=ai-usage&success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/settings?tab=ai-usage&canceled=true`,
    });

    if (!checkoutSession.url) {
      console.error("[STRIPE_CHECKOUT_ERROR] Stripe returned a session with no URL");
      return NextResponse.json({ error: "Stripe returned a session with no redirect URL" }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[STRIPE_CHECKOUT_ERROR]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
