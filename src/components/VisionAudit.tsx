"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Eye, CheckCircle2, Loader2, AlertTriangle, Lightbulb,
  Layout, Palette, TrendingUp, Wrench,
} from "lucide-react";
import type { VisionResult } from "@/types";

// ─── Stepped loading state ────────────────────────────────────────────────────

const STEPS = [
  { icon: "📡", text: "Capturing website pixels…" },
  { icon: "🧠", text: "VLM analyzing visual hierarchy…" },
  { icon: "✍️", text: "Generating design report…" },
];

export function VisionLoading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 4_500);
    const t2 = setTimeout(() => setStep(2), 11_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="mt-8 flex flex-col items-center gap-8 py-10">
      {/* Pulsing eye */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.2)] backdrop-blur-sm"
      >
        <Eye className="h-9 w-9 text-indigo-400" />
      </motion.div>

      {/* Step list */}
      <div className="space-y-3.5">
        {STEPS.map((s, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: i <= step ? 1 : 0.25, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            {i < step ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : i === step ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/25" />
            )}
            <span className={cn(
              "text-sm transition-colors",
              i === step ? "font-medium text-foreground" : "text-muted-foreground",
            )}>
              <span className="mr-1.5">{s.icon}</span>{s.text}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/50">This can take 15–25 seconds…</p>
    </div>
  );
}

// ─── macOS browser window mockup ──────────────────────────────────────────────

function BrowserMockup({ url, screenshotUrl }: { url: string; screenshotUrl: string }) {
  return (
    <div className={cn(
      "overflow-hidden rounded-2xl",
      "border border-white/20 dark:border-white/10",
      "shadow-[0_20px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
    )}>
      {/* Chrome bar */}
      <div className={cn(
        "flex items-center gap-3 border-b border-white/15 px-4 py-3",
        "bg-white/30 dark:bg-black/40 backdrop-blur-xl",
      )}>
        {/* Traffic lights */}
        <div className="flex shrink-0 gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          <div className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
          <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
        </div>
        {/* Address bar */}
        <div className="flex-1 overflow-hidden rounded-md bg-black/10 dark:bg-white/10 px-3 py-1.5">
          <p className="truncate text-xs text-muted-foreground">{url}</p>
        </div>
      </div>

      {/* Screenshot */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshotUrl}
          alt="Website screenshot captured for analysis"
          className="h-full w-full object-cover object-top"
        />
        {/* Bottom gradient fade */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
    </div>
  );
}

// ─── Glass section card ───────────────────────────────────────────────────────

function GlassCard({
  icon: Icon,
  title,
  accentClass,
  children,
}: {
  icon:        React.ElementType;
  title:       string;
  accentClass: string;
  children:    React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-5",
      "bg-white/10 dark:bg-white/5 backdrop-blur-md",
      "border-white/20 dark:border-white/10",
      "shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)]",
    )}>
      <p className={cn("mb-3 flex items-center gap-2 text-sm font-semibold", accentClass)}>
        <Icon className="h-4 w-4 shrink-0" />
        {title}
      </p>
      {children}
    </div>
  );
}

function BulletList({ items, dotClass }: { items: string[]; dotClass: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/75">
          <span className={cn("mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Actionable fixes table ───────────────────────────────────────────────────

function ActionableFixes({ fixes }: { fixes: VisionResult["actionableFixes"] }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5",
      "bg-white/10 dark:bg-white/5 backdrop-blur-md",
      "border-white/20 dark:border-white/10",
    )}>
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-500">
        <Wrench className="h-4 w-4 shrink-0" />
        Actionable Fixes
        <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
          {fixes.length}
        </span>
      </p>

      <div className="space-y-3">
        {fixes.map((fix, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            className="grid grid-cols-1 gap-3 rounded-xl border border-border/40 bg-background/30 p-3.5 sm:grid-cols-[auto_1fr_1fr]"
          >
            {/* Priority badge */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold tabular-nums text-amber-500">
              {i + 1}
            </div>

            {/* Element + issue */}
            <div className="min-w-0">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Element
              </p>
              <p className="text-xs font-medium text-foreground">{fix.element}</p>
              <div className="mt-1.5 flex items-start gap-1">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{fix.issue}</p>
              </div>
            </div>

            {/* Solution */}
            <div className="min-w-0">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Fix
              </p>
              <div className="flex items-start gap-1">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                <p className="text-xs text-emerald-500 dark:text-emerald-400">{fix.solution}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VisionAudit({ result }: { result: VisionResult }) {
  return (
    <div className="mt-8 space-y-6">
      {/* Overall impression banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={cn(
          "rounded-2xl border p-5",
          "bg-indigo-500/8 dark:bg-indigo-500/10 backdrop-blur-sm",
          "border-indigo-500/25",
        )}
      >
        <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-indigo-400">
          <Eye className="h-4 w-4 shrink-0" />
          Overall Impression
        </p>
        <p className="text-sm leading-relaxed text-foreground/80">{result.overallImpression}</p>
      </motion.div>

      {/* Two-column: screenshot + analysis cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT — browser mockup */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <BrowserMockup url={result.analyzedUrl} screenshotUrl={result.screenshotUrl} />
        </motion.div>

        {/* RIGHT — UX, UI, CRO cards */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-col gap-4"
        >
          <GlassCard icon={Layout} title="UX Analysis" accentClass="text-violet-400">
            <BulletList items={result.uxAnalysis} dotClass="bg-violet-500" />
          </GlassCard>

          <GlassCard icon={Palette} title="UI Analysis" accentClass="text-blue-400">
            <BulletList items={result.uiAnalysis} dotClass="bg-blue-500" />
          </GlassCard>

          <GlassCard icon={TrendingUp} title="CRO Suggestions" accentClass="text-emerald-400">
            <BulletList items={result.croSuggestions} dotClass="bg-emerald-500" />
          </GlassCard>
        </motion.div>
      </div>

      {/* Full-width actionable fixes */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <ActionableFixes fixes={result.actionableFixes} />
      </motion.div>
    </div>
  );
}
