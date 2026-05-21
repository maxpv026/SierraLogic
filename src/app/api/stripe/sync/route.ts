export const runtime = "nodejs";

/**
 * GET /api/stripe/sync?session_id=cs_xxx
 *
 * Active-sync fallback that bypasses the webhook entirely.
 *
 * PRIMARY PATH (session_id provided):
 *   Retrieve the Stripe checkout session by ID, extract the subscription +
 *   customer from it, and write the plan + Stripe IDs to the DB. This works
 *   even when the DB has no stripeCustomerId yet (first-ever purchase).
 *
 * FALLBACK PATH (no session_id):
 *   List the customer's active subscriptions via stripeCustomerId (requires
 *   a prior sync or webhook to have stored that ID).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }           from "next-auth";
import { authOptions }                from "@/lib/auth";
import { stripe, planFromPriceId }    from "@/lib/stripe";
import { prisma }                     from "@/lib/prisma";
import type Stripe                    from "stripe";
import type { ApiResponse }           from "@/types";

// ── Helper ────────────────────────────────────────────────────────────────────

function strId(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

// ── Shared DB write ───────────────────────────────────────────────────────────

async function writeToDb(
  userId:       string,
  planKey:      string,   // "PRO" | "MAX" — planFromPriceId never returns "FREE"
  subId:        string,
  priceId:      string,
  customerId:   string | null,
  periodEnd:    Date | null,
) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      plan:                   planKey,
      stripeSubscriptionId:   subId,
      stripePriceId:          priceId || undefined,
      stripeCurrentPeriodEnd: periodEnd ?? undefined,
      // Always store the customer ID so future syncs can use the fallback path
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
    select: { id: true, plan: true },
  });
  console.log(`[stripe/sync] ✅ DB updated — user ${updatedUser.id} → plan: ${updatedUser.plan}`);
  return updatedUser;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const stripeSessionId  = searchParams.get("session_id")?.trim() || null;

  // ── PRIMARY: resolve via Stripe checkout session ID ───────────────────────
  if (stripeSessionId) {
    console.log(`[stripe/sync] Retrieving checkout session: ${stripeSessionId}`);
    let checkoutSession: Stripe.Checkout.Session;
    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(stripeSessionId, {
        expand: ["subscription", "subscription.latest_invoice"],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe API error";
      console.error("[stripe/sync] Failed to retrieve checkout session:", msg);
      return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 502 });
    }

    console.log("📦 Checkout session — customer:", checkoutSession.customer, "| sub:", checkoutSession.subscription);

    const customerId = strId(checkoutSession.customer);
    const sub        = checkoutSession.subscription as Stripe.Subscription | null;

    if (!sub) {
      console.error("[stripe/sync] Checkout session has no subscription attached");
      return NextResponse.json<ApiResponse>({ success: false, error: "No subscription on session" }, { status: 422 });
    }

    // priceId: subscription items first, then session metadata fallback
    const priceId = sub.items.data[0]?.price?.id
      ?? strId(checkoutSession.metadata?.priceId as string | undefined)
      ?? "";

    console.log(`[stripe/sync] priceId from session: ${priceId}`);

    const planKey = planFromPriceId(priceId);
    if (!planKey) {
      console.error(
        `[stripe/sync] Unrecognised priceId "${priceId}".\n` +
        `   STRIPE_PRO_PRICE_ID:       ${process.env.STRIPE_PRO_PRICE_ID ?? "(not set)"}\n` +
        `   NEXT_PUBLIC_STRIPE_PRO_ID: ${process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "(not set)"}\n` +
        `   STRIPE_MAX_PRICE_ID:       ${process.env.STRIPE_MAX_PRICE_ID ?? "(not set)"}\n` +
        `   NEXT_PUBLIC_STRIPE_MAX_ID: ${process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID ?? "(not set)"}`,
      );
      // Return current DB plan — don't overwrite with garbage
      const cur = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
      return NextResponse.json<ApiResponse<{ plan: string }>>({ success: true, data: { plan: cur?.plan ?? "FREE" } });
    }

    const invoice   = sub.latest_invoice as Stripe.Invoice | null;
    const periodEnd = invoice?.period_end ? new Date(invoice.period_end * 1000) : null;

    try {
      const updatedUser = await writeToDb(userId, planKey, sub.id, priceId, customerId, periodEnd);
      return NextResponse.json<ApiResponse<{ plan: string }>>({ success: true, data: { plan: updatedUser.plan } });
    } catch (err) {
      console.error("[stripe/sync] Prisma write failed (session path):", err);
      return NextResponse.json<ApiResponse>({ success: false, error: "Database update failed" }, { status: 500 });
    }
  }

  // ── FALLBACK: resolve via stored stripeCustomerId ─────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { stripeCustomerId: true, plan: true },
  });

  if (!user) {
    return NextResponse.json<ApiResponse>({ success: false, error: "User not found" }, { status: 404 });
  }

  if (!user.stripeCustomerId) {
    console.log(`[stripe/sync] userId ${userId} has no stripeCustomerId and no session_id — cannot sync`);
    return NextResponse.json<ApiResponse<{ plan: string }>>({ success: true, data: { plan: user.plan } });
  }

  console.log(`[stripe/sync] Listing active subscriptions for customer: ${user.stripeCustomerId}`);

  let subscriptions: Awaited<ReturnType<typeof stripe.subscriptions.list>>;
  try {
    subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status:   "active",
      limit:    5,
      expand:   ["data.latest_invoice"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe API error";
    console.error("[stripe/sync] Failed to list subscriptions:", msg);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 502 });
  }

  console.log(`[stripe/sync] Found ${subscriptions.data.length} active subscription(s)`);

  if (subscriptions.data.length === 0) {
    if (user.plan !== "FREE") {
      await prisma.user.update({
        where: { id: userId },
        data:  { plan: "FREE", stripeSubscriptionId: null, stripePriceId: null, stripeCurrentPeriodEnd: null },
      });
    }
    return NextResponse.json<ApiResponse<{ plan: string }>>({ success: true, data: { plan: "FREE" } });
  }

  const sub     = subscriptions.data[0];
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const planKey = planFromPriceId(priceId);

  if (!planKey) {
    console.error(`[stripe/sync] Unrecognised priceId "${priceId}" (fallback path)`);
    return NextResponse.json<ApiResponse<{ plan: string }>>({ success: true, data: { plan: user.plan } });
  }

  const invoice   = sub.latest_invoice as Stripe.Invoice | null;
  const periodEnd = invoice?.period_end ? new Date(invoice.period_end * 1000) : null;

  try {
    const updatedUser = await writeToDb(userId, planKey, sub.id, priceId, user.stripeCustomerId, periodEnd);
    return NextResponse.json<ApiResponse<{ plan: string }>>({ success: true, data: { plan: updatedUser.plan } });
  } catch (err) {
    console.error("[stripe/sync] Prisma write failed (fallback path):", err);
    return NextResponse.json<ApiResponse>({ success: false, error: "Database update failed" }, { status: 500 });
  }
}
