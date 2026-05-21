"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n-context";
import {
  ArrowLeft, PenTool, Megaphone, Settings2, Mail,
  Sparkles, ListChecks, Zap,
} from "lucide-react";

// ─── Shared glass token ───────────────────────────────────────────────────────

const GLASS = cn(
  "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-2xl",
  "border border-white/30 dark:border-white/10",
  "shadow-[0_12px_48px_-10px_rgba(0,0,0,0.12)]",
  "rounded-[2.5rem] p-6",
);

// ─── Use-case cards ───────────────────────────────────────────────────────────

interface UseCase {
  icon:        React.ElementType;
  iconBg:      string;
  iconColor:   string;
  glowColor:   string;
  title:       string;
  description: string;
  tags:        string[];
}

const USE_CASES: UseCase[] = [
  {
    icon:        PenTool,
    iconBg:      "bg-violet-500/15",
    iconColor:   "text-violet-400",
    glowColor:   "rgba(139,92,246,0.25)",
    title:       "Отримайте теми для блогу",
    description: "Генерація трендових ідей для контенту на основі аналізу SEO-ніші та поведінки аудиторії.",
    tags:        ["Контент", "SEO", "Тренди"],
  },
  {
    icon:        Megaphone,
    iconBg:      "bg-orange-500/15",
    iconColor:   "text-orange-400",
    glowColor:   "rgba(249,115,22,0.25)",
    title:       "Генерація плану для соцмереж",
    description: "Автоматизація SMM-стратегії для підвищення залученості та охоплення у всіх каналах.",
    tags:        ["SMM", "Охоплення", "Залученість"],
  },
  {
    icon:        Settings2,
    iconBg:      "bg-blue-500/15",
    iconColor:   "text-blue-400",
    glowColor:   "rgba(59,130,246,0.25)",
    title:       "Автоматизація SEO",
    description: "Покращення позицій у пошуку за допомогою технічного аудиту, оптимізації мета-тегів і контенту.",
    tags:        ["Технічне SEO", "Ключові слова", "Аудит"],
  },
  {
    icon:        Mail,
    iconBg:      "bg-amber-500/15",
    iconColor:   "text-amber-400",
    glowColor:   "rgba(245,158,11,0.25)",
    title:       "Персоналізація email-розсилок",
    description: "Збільшення відкритості листів через персоналізовані теми та автоматичні воронки продажів.",
    tags:        ["Email", "Конверсія", "Воронка"],
  },
  {
    icon:        Zap,
    iconBg:      "bg-emerald-500/15",
    iconColor:   "text-emerald-400",
    glowColor:   "rgba(16,185,129,0.25)",
    title:       "Оптимізація конверсій (CRO)",
    description: "Аналіз слабких місць сайту та генерація конкретних рекомендацій для збільшення продажів.",
    tags:        ["CRO", "A/B-тести", "UX"],
  },
  {
    icon:        ListChecks,
    iconBg:      "bg-indigo-500/15",
    iconColor:   "text-indigo-400",
    glowColor:   "rgba(99,102,241,0.25)",
    title:       "Стратегічний план дій",
    description: "AI-генерований пріоритизований список задач на основі аналізу конкурентів і сайту клієнта.",
    tags:        ["Планування", "AI", "Стратегія"],
  },
];

// ─── Use-case card ────────────────────────────────────────────────────────────

function UseCaseCard({ uc, index }: { uc: UseCase; index: number }) {
  const Icon = uc.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      className={cn(
        "group flex flex-col gap-5",
        "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-3xl",
        "border border-white/30 dark:border-white/10",
        "shadow-[0_12px_48px_-10px_rgba(0,0,0,0.12)]",
        "rounded-[2.5rem] p-6",
        "hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.18)]",
        "transition-all duration-300",
      )}
      style={{
        boxShadow: `0 12px 40px -10px ${uc.glowColor}, 0 0 0 1px rgba(255,255,255,0.08)`,
      }}
    >
      {/* Icon */}
      <div className={cn(
        "inline-flex h-14 w-14 items-center justify-center rounded-2xl",
        uc.iconBg,
        "transition-transform duration-300 group-hover:scale-110",
      )}>
        <Icon className={cn("h-7 w-7", uc.iconColor)} strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <h3 className="text-base font-bold text-foreground leading-snug">{uc.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{uc.description}</p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {uc.tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              "bg-white/20 dark:bg-white/8 border border-white/30 dark:border-white/10",
              "text-foreground/70",
            )}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

const STATS = [
  { value: "4×",   label: "швидше, ніж вручну" },
  { value: "6",    label: "ШІ-агентів паралельно" },
  { value: "100%", label: "персоналізовані задачі" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { lang } = useLang();

  const heading = lang === "uk"
    ? "ШІ-план дій"
    : lang === "de"
      ? "KI-Aktionsplan"
      : lang === "fr"
        ? "Plan d'action IA"
        : lang === "pl"
          ? "Plan działania AI"
          : "AI Action Plan";

  const sub = lang === "uk"
    ? "Автоматично генерує пріоритизований список задач на основі аналізу вашого сайту"
    : "Automatically generates a prioritized task list based on your website analysis";

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-white/15 bg-white/20 dark:bg-black/20 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {lang === "uk" ? "Назад" : "Back"}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-foreground">{heading}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 space-y-14">

        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            {lang === "uk" ? "Покращено за допомогою AI" : "Powered by AI"}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {heading}
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted-foreground leading-relaxed">
            {sub}
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={cn(GLASS, "grid grid-cols-3 divide-x divide-white/20 dark:divide-white/8 p-0 overflow-hidden")}
        >
          {STATS.map((s) => (
            <div key={s.value} className="flex flex-col items-center gap-1 py-6 px-4 text-center">
              <span className="text-2xl font-extrabold tabular-nums text-foreground">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Use-case grid */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60"
          >
            {lang === "uk" ? "Приклади завдань" : "Use cases"}
          </motion.p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:w-4/5 lg:mx-auto">
            {USE_CASES.map((uc, i) => (
              <UseCaseCard key={uc.title} uc={uc} index={i} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className={cn(GLASS, "text-center space-y-4")}
        >
          <h2 className="text-xl font-bold text-foreground">
            {lang === "uk"
              ? "Готові до аналізу?"
              : "Ready to analyze your site?"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === "uk"
              ? "Введіть URL сайту на головній сторінці і AI автоматично згенерує план дій."
              : "Enter your website URL on the main page and the AI will generate your action plan."}
          </p>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl px-6 py-3",
              "text-sm font-bold text-white",
              "bg-gradient-to-r from-indigo-600 to-violet-600",
              "shadow-[0_4px_20px_rgba(99,102,241,0.4)]",
              "transition-all hover:shadow-[0_4px_28px_rgba(99,102,241,0.55)] hover:opacity-95",
            )}
          >
            <Sparkles className="h-4 w-4" />
            {lang === "uk" ? "✨ Аналізувати сайт" : "Analyze a site"}
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
