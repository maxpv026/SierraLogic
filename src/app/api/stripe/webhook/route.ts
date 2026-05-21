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

  if (!WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook signature");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Webhook signature verification failed:", msg);
    console.error("   stripe-signature header:", signature ? signature.slice(0, 40) + "…" : "(missing)");
    console.error("   raw body length:", rawBody.length);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  console.log(`\n🔔 Webhook received: ${event.type} (id: ${event.id})`);

  try {
    switch (event.type) {

      // ── New subscription / plan upgrade ───────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Full session dump so nothing is hidden ─────────────────────────
        console.log("📦 Session Metadata:", JSON.stringify(session.metadata, null, 2));
        console.log("👤 Client Reference ID (User ID):", session.client_reference_id);
        console.log("🔑 Session ID:", session.id);
        console.log("💳 Mode:", session.mode);
        console.log("📋 Subscription ID:", session.subscription);

        if (session.mode !== "subscription") {
          console.log("⏭  Not a subscription session — skipping");
          break;
        }

        // ── userId extraction ──────────────────────────────────────────────
        const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
        console.log("👤 Resolved userId:", userId);
        if (!userId) {
          console.error(
            "❌ No userId found in client_reference_id or metadata.userId.\n" +
            "   Verify that stripe.checkout.sessions.create() sets client_reference_id: userId.",
          );
          break;
        }

        // ── subscriptionId ─────────────────────────────────────────────────
        const subId = strId(session.subscription);
        console.log("📄 Resolved subscriptionId:", subId);
        if (!subId) {
          console.error("❌ Missing subscription ID in session");
          break;
        }

        // ── Retrieve subscription to get priceId ───────────────────────────
        console.log("⏳ Retrieving subscription from Stripe…");
        const subscription = await stripe.subscriptions.retrieve(subId, {
          expand: ["latest_invoice"],
        });

        // Try subscription items first; fall back to session metadata
        const priceIdFromSub      = subscription.items.data[0]?.price?.id ?? "";
        const priceIdFromMeta     = session.metadata?.priceId ?? "";
        const priceId             = priceIdFromSub || priceIdFromMeta;

        console.log("💰 Price ID from subscription items:", priceIdFromSub);
        console.log("💰 Price ID from session metadata:  ", priceIdFromMeta);
        console.log("💰 Price ID used for plan lookup:   ", priceId);

        // ── Plan resolution ────────────────────────────────────────────────
        const planKey = planFromPriceId(priceId);
        console.log("🗺  planFromPriceId result:", planKey ?? "null (unrecognised)");
        console.log(
          "   ENV STRIPE_PRO_PRICE_ID      :", process.env.STRIPE_PRO_PRICE_ID ?? "(not set)",
          "\n   ENV NEXT_PUBLIC_STRIPE_PRO_ID:", process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "(not set)",
          "\n   ENV STRIPE_MAX_PRICE_ID      :", process.env.STRIPE_MAX_PRICE_ID ?? "(not set)",
          "\n   ENV NEXT_PUBLIC_STRIPE_MAX_ID:", process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID ?? "(not set)",
        );

        if (!planKey) {
          console.error(
            `❌ Unrecognised priceId "${priceId}" — plan NOT updated.\n` +
            `   Set STRIPE_PRO_PRICE_ID / STRIPE_MAX_PRICE_ID (or NEXT_PUBLIC_ variants) to match this priceId.`,
          );
          break;
        }

        // ── Build update payload ───────────────────────────────────────────
        const customerId = strId(subscription.customer);
        const invoice    = subscription.latest_invoice as Stripe.Invoice | null;
        const periodEnd  = invoice ? new Date(invoice.period_end * 1000) : null;

        console.log("🏪 customerId:", customerId);
        console.log("📅 Period end:", periodEnd?.toISOString() ?? "n/a");

        // ── Prisma update with isolated try/catch ─────────────────────────
        try {
          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
              plan:                   planKey,
              stripeCustomerId:       customerId ?? undefined,
              stripeSubscriptionId:   subId,
              stripePriceId:          priceId    || undefined,
              stripeCurrentPeriodEnd: periodEnd  ?? undefined,
            },
            select: { id: true, email: true, plan: true },
          });
          console.log("✅ DB successfully updated for user:", updatedUser.id, "Plan set to:", updatedUser.plan);
        } catch (prismaError) {
          console.error("❌ Prisma Database Update Failed:", prismaError);
          // Return 500 so Stripe retries the webhook
          return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

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
