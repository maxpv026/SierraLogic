import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

// ── Plan metadata ─────────────────────────────────────────────────────────────

// Accept both the server-side and NEXT_PUBLIC_ variants so the same price ID
// works regardless of which env var name the user configured.
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "";
const MAX_PRICE_ID = process.env.STRIPE_MAX_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID ?? "";

export const PLANS = {
  FREE: { name: "Free", analysesPerMonth: 50,      priceId: null },
  PRO:  { name: "Pro",  analysesPerMonth: 500,      priceId: PRO_PRICE_ID },
  MAX:  { name: "Max",  analysesPerMonth: Infinity, priceId: MAX_PRICE_ID },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Map a Stripe Price ID back to our plan key. Returns null if unrecognised. */
export function planFromPriceId(priceId: string): PlanKey | null {
  if (!priceId) return null;
  if (PRO_PRICE_ID && priceId === PRO_PRICE_ID) return "PRO";
  if (MAX_PRICE_ID && priceId === MAX_PRICE_ID) return "MAX";
  return null;
}
