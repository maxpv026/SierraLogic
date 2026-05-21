"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Swords, ArrowLeft, Trophy, Lightbulb, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { BattleChart } from "@/components/BattleChart";
import type { ApiResponse, CompareResult } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hostname(url: string) {
  try { return new URL(url).hostname; }
  catch { return url; }
}

// ─── Squircle input ───────────────────────────────────────────────────────────

function SquircleInput({
  value,
  onChange,
  placeholder,
  disabled,
  loading,
}: {
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  disabled:    boolean;
  loading:     boolean;
}) {
  return (
    <motion.div
      className={cn(
        "relative flex items-center rounded-[2rem]",
        "border border-border/50 bg-card/80 backdrop-blur-xl",
        "shadow-2xl",
        "focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-400/40",
        "transition-[box-shadow,border-color] duration-300",
      )}
      animate={loading ? {
        boxShadow: [
          "0 0 0 2px rgba(99,102,241,0.25), 0 25px 50px -12px rgba(0,0,0,0.2)",
          "0 0 28px 8px rgba(99,102,241,0.45), 0 25px 50px -12px rgba(0,0,0,0.2)",
          "0 0 0 2px rgba(99,102,241,0.25), 0 25px 50px -12px rgba(0,0,0,0.2)",
        ],
      } : {
        boxShadow: "0 20px 60px -15px rgba(0,0,0,0.18)",
      }}
      transition={loading
        ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
        : { duration: 0.4 }
      }
    >
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "min-w-0 flex-1 bg-transparent",
          "py-5 pl-7 pr-6",
          "text-lg text-foreground",
          "placeholder:text-muted-foreground/45 placeholder:font-light",
          "outline-none border-none focus:outline-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      />
    </motion.div>
  );
}

// ─── VS badge ─────────────────────────────────────────────────────────────────

function VsBadge({ loading }: { loading: boolean }) {
  return (
    <motion.div
      className="shrink-0 select-none text-center"
      animate={loading ? {
        scale:   [1, 1.15, 1],
        opacity: [0.7, 1, 0.7],
      } : { scale: 1, opacity: 1 }}
      transition={loading
        ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
        : { duration: 0.3 }
      }
    >
      <span className={cn(
        "font-black text-2xl tracking-widest",
        "bg-gradient-to-r from-violet-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent",
        "drop-shadow-[0_0_12px_rgba(167,139,250,0.6)]",
        loading && "drop-shadow-[0_0_20px_rgba(167,139,250,0.9)]",
      )}>
        VS
      </span>
    </motion.div>
  );
}

// ─── Result cards ─────────────────────────────────────────────────────────────

function StrengthsList({
  items,
  label,
  colorClass,
  dotClass,
}: {
  items:      string[];
  label:      string;
  colorClass: string;
  dotClass:   string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5", colorClass)}>
      <p className={cn("mb-3 flex items-center gap-2 text-sm font-semibold", dotClass.replace("bg-", "text-").replace("[#6366f1]", "[#818cf8]").replace("[#10b981]", "[#34d399]"))}>
        <span className={cn("inline-block h-2 w-2 rounded-full", dotClass)} />
        {label}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className={cn("mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [url1, setUrl1]       = useState("");
  const [url2, setUrl2]       = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<CompareResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url1.trim() || !url2.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze/compare", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url1: url1.trim(), url2: url2.trim() }),
      });

      let data: ApiResponse<CompareResult>;
      try {
        data = await res.json();
      } catch {
        setError(`Server error (${res.status}) — check the console for details.`);
        return;
      }

      if (!data.success || !data.data) {
        setError(data.error ?? "Comparison failed — please try again.");
        return;
      }

      setResult(data.data);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const site1Label = result ? hostname(result.site1Url) : hostname(url1) || "Site 1";
  const site2Label = result ? hostname(result.site2Url) : hostname(url2) || "Site 2";

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav bar */}
      <div className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <Swords className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-foreground">Battle Mode</span>
        </div>
        <div className="flex-1" />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Page header */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 ring-1 ring-violet-500/20">
            <Swords className="h-7 w-7 text-violet-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Battle Mode</h1>
          <p className="mt-2 text-muted-foreground">
            Compare any two websites head-to-head with AI-powered competitive analysis.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="w-full flex-1">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-indigo-400">
                Site 1
              </p>
              <SquircleInput
                value={url1}
                onChange={setUrl1}
                placeholder="https://competitor-a.com"
                disabled={loading}
                loading={loading}
              />
            </div>

            <VsBadge loading={loading} />

            <div className="w-full flex-1">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-400">
                Site 2
              </p>
              <SquircleInput
                value={url2}
                onChange={setUrl2}
                placeholder="https://competitor-b.com"
                disabled={loading}
                loading={loading}
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={loading || !url1.trim() || !url2.trim()}
              className={cn(
                "inline-flex items-center gap-2.5",
                "rounded-[1.4rem] px-8 py-3.5",
                "bg-violet-600 text-white text-base font-semibold tracking-wide",
                "shadow-lg shadow-violet-500/25",
                "transition-all duration-200",
                "hover:bg-violet-700 hover:shadow-violet-500/40",
                "active:scale-[0.97]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing both sites…
                </>
              ) : (
                <>
                  <Swords className="h-4 w-4" />
                  Start Battle
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-5"
            >
              {/* Radar chart */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Competitive Radar
                </p>
                <BattleChart
                  data={result.radarData}
                  site1Label={site1Label}
                  site2Label={site2Label}
                />
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-violet-500/30 bg-violet-950/15 p-5">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-300">
                  <Trophy className="h-4 w-4" />
                  Verdict
                </p>
                <p className="text-sm leading-relaxed text-foreground">{result.verdict}</p>
              </div>

              {/* Strengths + Advice grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                <StrengthsList
                  items={result.site1Strengths}
                  label={site1Label}
                  colorClass="border-indigo-500/25"
                  dotClass="bg-[#6366f1]"
                />
                <StrengthsList
                  items={result.site2Strengths}
                  label={site2Label}
                  colorClass="border-emerald-500/25"
                  dotClass="bg-[#10b981]"
                />
                <div className="rounded-2xl border border-amber-500/25 bg-card p-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                    Actionable Advice
                  </p>
                  <ul className="space-y-2">
                    {result.actionableAdvice.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Run again button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => { setResult(null); setError(null); }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
                >
                  Run another comparison
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
