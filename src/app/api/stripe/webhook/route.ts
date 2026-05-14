// Stripe sends the raw body — never parse it as JSON before signature verification.
// Next.js App Router gives us req.text() which preserves the raw bytes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type Stripe                    from "stripe";
import { stripe, planFromPriceId }    from "@/lib/stripe";
import { prisma }                     from "@/lib/prisma";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function strId(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  console.log(`[stripe/webhook] ${event.type} (${event.id})`);

  try {
    switch (event.type) {

      // ── New subscription / plan upgrade ───────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.client_reference_id ?? session.metadata?.userId;
        if (!userId) { console.warn("[stripe/webhook] checkout.session.completed: missing userId"); break; }

        const subId = strId(session.subscription);
        if (!subId) { console.warn("[stripe/webhook] checkout.session.completed: missing subscriptionId"); break; }

        const subscription = await stripe.subscriptions.retrieve(subId, {
          expand: ["latest_invoice"],
        });

        const priceId    = subscription.items.data[0]?.price?.id ?? "";
        const plan        = planFromPriceId(priceId) ?? "FREE";
        const customerId  = strId(subscription.customer);

        // Period end comes from the subscription's latest invoice
        // (current_period_end was removed in the 2026-04-22 API)
        const invoice    = subscription.latest_invoice as Stripe.Invoice | null;
        const periodEnd  = invoice ? new Date(invoice.period_end * 1000) : null;

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeCustomerId:       customerId      ?? undefined,
            stripeSubscriptionId:   subId,
            stripePriceId:          priceId         || undefined,
            stripeCurrentPeriodEnd: periodEnd       ?? undefined,
          },
        });

        console.log(`[stripe/webhook] User ${userId} → ${plan}`);
        break;
      }

      // ── Subscription renewal ─────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice  = event.data.object as Stripe.Invoice;
        const periodEnd = new Date(invoice.period_end * 1000);

        // In the 2026-04-22 API, subscription reference is in invoice.parent
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId  = strId(subRef);
        if (!subId) break;

        const subscription = await stripe.subscriptions.retrieve(subId);
        const priceId      = subscription.items.data[0]?.price?.id ?? "";
        const plan         = planFromPriceId(priceId) ?? "FREE";

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subId },
          data:  { stripeCurrentPeriodEnd: periodEnd, stripePriceId: priceId || undefined, plan },
        });

        console.log(`[stripe/webhook] Renewed ${subId} → ${plan}, period ends ${periodEnd.toISOString()}`);
        break;
      }

      // ── Subscription cancelled → downgrade to FREE ───────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan:                   "FREE",
            stripeSubscriptionId:   null,
            stripePriceId:          null,
            stripeCurrentPeriodEnd: null,
          },
        });

        console.log(`[stripe/webhook] Subscription ${subscription.id} cancelled → FREE`);
        break;
      }

      // ── Payment failed (optional notification hook point) ────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[stripe/webhook] Payment failed for invoice ${invoice.id}`);
        break;
      }

      default:
        console.log(`[stripe/webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown handler error";
    console.error("[stripe/webhook] Handler error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
