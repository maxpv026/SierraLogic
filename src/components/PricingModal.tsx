"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, X, Check, Sparkles, Zap, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PRICING_PLANS = [
  {
    id:          "PRO" as const,
    name:        "Pro",
    price:       "$19",
    period:      "/ month",
    description: "For professionals and growing teams.",
    icon:        Zap,
    popular:     true,
    features: [
      "500 analyses per month",
      "Priority AI processing",
      "5 output languages (EN, UK, DE, FR, PL)",
      "Full SEO keyword analysis",
      "Analysis history & saved results",
      "Email support",
    ],
  },
  {
    id:          "MAX" as const,
    name:        "Max",
    price:       "$49",
    period:      "/ month",
    description: "For power users who need unlimited scale.",
    icon:        Sparkles,
    popular:     false,
    features: [
      "Unlimited analyses",
      "Priority processing & dedicated support",
      "Everything in Pro",
      "Early access to new features",
      "API access (coming soon)",
      "Team workspaces (coming soon)",
    ],
  },
] as const;

type PlanId = (typeof PRICING_PLANS)[number]["id"];

// ─── Checkout helper ──────────────────────────────────────────────────────────

async function startCheckout(plan: PlanId, setLoading: (p: PlanId | null) => void) {
  setLoading(plan);
  try {
    const res = await fetch("/api/stripe/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast.error(data.error ?? "Could not start checkout. Try again.");
      setLoading(null);
    }
  } catch {
    toast.error("Network error — please try again.");
    setLoading(null);
  }
}

// ─── Pricing card ─────────────────────────────────────────────────────────────

function PricingCard({
  plan,
  currentPlan,
  loadingPlan,
  onSelect,
}: {
  plan:        (typeof PRICING_PLANS)[number];
  currentPlan: string;
  loadingPlan: PlanId | null;
  onSelect:    (id: PlanId) => void;
}) {
  const Icon       = plan.icon;
  const isActive   = currentPlan === plan.id;
  const isLoading  = loadingPlan === plan.id;
  const isDisabled = !!loadingPlan;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition-all",
        plan.popular
          ? "border-indigo-500 bg-indigo-950/30 dark:bg-indigo-950/40 shadow-lg shadow-indigo-500/10"
          : "border-border bg-card",
      )}
    >
      {/* Most popular badge */}
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 px-3 text-xs font-semibold">
            Most Popular
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className={cn(
          "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl",
          plan.popular ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-5 w-5" />
        </div>

        <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>

        <div className="mt-4 flex items-end gap-1">
          <span className="text-4xl font-extrabold tracking-tight text-foreground">{plan.price}</span>
          <span className="mb-1 text-sm text-muted-foreground">{plan.period}</span>
        </div>
      </div>

      {/* Features */}
      <ul className="mb-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              plan.popular ? "text-indigo-400" : "text-emerald-500",
            )} />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isActive ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground">
          <Check className="h-4 w-4 text-emerald-500" />
          Current plan
        </div>
      ) : (
        <Button
          className={cn(
            "w-full rounded-xl font-semibold",
            plan.popular && "bg-indigo-600 hover:bg-indigo-700 text-white",
          )}
          variant={plan.popular ? "default" : "outline"}
          disabled={isDisabled}
          onClick={() => onSelect(plan.id)}
        >
          {isLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : `Upgrade to ${plan.name}`}
        </Button>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface PricingModalProps {
  open:        boolean;
  onClose:     () => void;
  currentPlan: string;
}

export function PricingModal({ open, onClose, currentPlan }: PricingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  function handleSelect(plan: PlanId) {
    startCheckout(plan, setLoadingPlan);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="px-6 pb-4 pt-8 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Upgrade SierraLogic
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a plan and unlock more AI analyses every month.
                </p>
              </div>

              {/* Cards */}
              <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
                {PRICING_PLANS.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    currentPlan={currentPlan}
                    loadingPlan={loadingPlan}
                    onSelect={handleSelect}
                  />
                ))}
              </div>

              {/* Footer note */}
              <div className="border-t border-border px-6 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Billed monthly. Cancel anytime from your billing portal.
                  Secure payments powered by{" "}
                  <span className="font-medium text-foreground">Stripe</span>.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
