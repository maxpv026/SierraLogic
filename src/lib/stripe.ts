import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

// ── Plan metadata ─────────────────────────────────────────────────────────────

export const PLANS = {
  FREE: { name: "Free", analysesPerMonth: 50,      priceId: null },
  PRO:  { name: "Pro",  analysesPerMonth: 500,      priceId: process.env.STRIPE_PRO_PRICE_ID ?? "" },
  MAX:  { name: "Max",  analysesPerMonth: Infinity, priceId: process.env.STRIPE_MAX_PRICE_ID ?? "" },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Map a Stripe Price ID back to our plan key. Returns null if unrecognised. */
export function planFromPriceId(priceId: string): PlanKey | null {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === process.env.STRIPE_MAX_PRICE_ID) return "MAX";
  return null;
}
