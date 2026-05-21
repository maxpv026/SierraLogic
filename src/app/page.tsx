"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, TrendingUp, TrendingDown, Minus, Globe,
  Sun, Moon, PanelLeft, ChevronRight, Layers, Settings, LogOut, ChevronUp, BarChart2, X, Swords,
  Trophy, Lightbulb, Plus, Eye, Briefcase, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import { WebsiteChat }    from "@/components/WebsiteChat";
import { BattleChart }       from "@/components/BattleChart";
import { BoardOfDirectors, BoardSkeleton } from "@/components/BoardOfDirectors";
import { KanbanBoard }     from "@/components/KanbanBoard";
import { VisionAudit, VisionLoading } from "@/components/VisionAudit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { AnalysisResult, ApiResponse, CompareResult, Sentiment, TaskItem, VisionResult } from "@/types";

import { LABELS, LANG_NAMES, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/i18n-context";

// ─── Config constants ─────────────────────────────────────────────────────────

const SENTIMENT_CONFIG: Record<Sentiment, {
  label: Record<Lang, string>;
  icon: React.ElementType;
  className: string;
  dot: string;
}> = {
  positive: {
    label: { en: "Positive", uk: "Позитивна", de: "Positiv", fr: "Positif", pl: "Pozytywny" },
    icon: TrendingUp,
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  neutral: {
    label: { en: "Neutral", uk: "Нейтральна", de: "Neutral", fr: "Neutre", pl: "Neutralny" },
    icon: Minus,
    className: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    dot: "bg-slate-400",
  },
  negative: {
    label: { en: "Negative", uk: "Негативна", de: "Negativ", fr: "Négatif", pl: "Negatywny" },
    icon: TrendingDown,
    className: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    dot: "bg-red-500",
  },
};

const PLATFORM_MODES: Array<{ value: string } & Record<Lang, string>> = [
  { value: "standard", en: "Standard Analysis", uk: "Стандартний аналіз", de: "Standard-Analyse",    fr: "Analyse standard",   pl: "Standardowa analiza" },
  { value: "seo",      en: "SEO Focus",          uk: "SEO-фокус",          de: "SEO-Fokus",             fr: "Focus SEO",           pl: "Skupienie na SEO" },
  { value: "deep",     en: "Deep Content Audit", uk: "Глибокий аудит",     de: "Tiefer Inhaltsaudit",   fr: "Audit approfondi",    pl: "Głęboki audyt treści" },
];

// Maps UI lang code → full language name sent to the AI
// Sidebar tips (localised, non-interactive)
const TIPS: Array<{ icon: string } & Record<Lang, string>> = [
  {
    icon: "💡",
    en: "Pro Tip: Use specific product page URLs for deeper analysis.",
    uk: "Порада: Конкретні URL сторінок дають глибший аналіз.",
    de: "Tipp: Spezifische Produkt-URLs liefern tiefere Analysen.",
    fr: "Astuce : Des URL spécifiques donnent une analyse plus profonde.",
    pl: "Wskazówka: Konkretne adresy URL dają głębszą analizę.",
  },
  {
    icon: "🔜",
    en: "Coming soon: Compare two websites side-by-side.",
    uk: "Незабаром: Порівняння двох сайтів паралельно.",
    de: "Demnächst: Zwei Websites direkt vergleichen.",
    fr: "Bientôt : Comparez deux sites côte à côte.",
    pl: "Wkrótce: Porównaj dwie strony obok siebie.",
  },
  {
    icon: "🌐",
    en: "AI output language follows your UI language selection.",
    uk: "Мова відповіді AI відповідає мові інтерфейсу.",
    de: "Die KI-Ausgabesprache folgt Ihrer UI-Sprache.",
    fr: "La langue de l'IA suit votre langue d'interface.",
    pl: "Język AI odpowiada wybranej przez Ciebie języku UI.",
  },
];

// ─── Greeting ─────────────────────────────────────────────────────────────────

const GREETINGS: Record<Lang, [string, string, string, string]> = {
  en: ["Good morning",   "Good afternoon", "Good evening", "Good night"],
  uk: ["Доброго ранку",  "Доброго дня",    "Доброго вечора", "Доброї ночі"],
  de: ["Guten Morgen",   "Guten Tag",      "Guten Abend",    "Gute Nacht"],
  fr: ["Bonjour",        "Bon après-midi", "Bonsoir",        "Bonne nuit"],
  pl: ["Dzień dobry",    "Dzień dobry",    "Dobry wieczór",  "Dobranoc"],
};

const GUEST_NAME: Record<Lang, string> = {
  en: "Guest", uk: "Гість", de: "Gast", fr: "Invité", pl: "Gość",
};

const FRIEND_NAME: Record<Lang, string> = {
  en: "Friend", uk: "Друже", de: "Freund", fr: "Ami", pl: "Przyjacielu",
};

function getGreeting(hour: number, lang: Lang): string {
  const [morning, afternoon, evening, night] = GREETINGS[lang];
  if (hour >= 5  && hour < 12) return morning;
  if (hour >= 12 && hour < 18) return afternoon;
  if (hour >= 18 && hour < 23) return evening;
  return night;
}

function Greeting({ lang }: { lang: Lang }) {
  const { data: session, status } = useSession();
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (status === "loading") {
    return <Skeleton className="mx-auto h-10 w-64" />;
  }

  const greeting = getGreeting(hour, lang);

  if (status === "authenticated" && session?.user) {
    const name = session.user.name?.split(" ")[0] ?? session.user.email ?? FRIEND_NAME[lang];
    return (
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {greeting}, {name}! 👋
      </h1>
    );
  }

  return (
    <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
      {greeting}, {GUEST_NAME[lang]}! 👋
    </h1>
  );
}

// ─── Sentiment pill ───────────────────────────────────────────────────────────

function SentimentPill({ sentiment, lang }: { sentiment: Sentiment; lang: Lang }) {
  const cfg = SENTIMENT_CONFIG[sentiment];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", cfg.className)}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label[lang]}
    </span>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

// ─── Sidebar profile ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-cyan-500",
];

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

function avatarBg(name: string | null | undefined): string {
  const code = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[code];
}

function SidebarProfile({ collapsed, lang }: { collapsed: boolean; lang: Lang }) {
  const { data: session } = useSession();
  const t = LABELS[lang];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const user = session?.user;
  const name = user?.name ?? "User";
  const image = user?.image;
  const initials = getInitials(user?.name);

  return (
    <div ref={ref} className="relative shrink-0 border-t border-border/50 p-2">
      {/* Popover menu — opens above the button */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute bottom-full left-2 right-2 mb-1.5 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              {t.settings}
            </Link>
            <div className="border-t border-border" />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              {t.signOut}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent",
          collapsed ? "justify-center" : "",
        )}
        aria-label="User menu"
      >
        {/* Avatar */}
        <div className={cn(
          "h-7 w-7 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white",
          !image && avatarBg(user?.name),
        )}>
          {image
            ? <img src={image} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            : initials
          }
        </div>

        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground">
              {name}
            </span>
            <ChevronUp
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150",
                open ? "rotate-180" : "",
              )}
            />
          </>
        )}
      </button>
    </div>
  );
}

// ─── Sidebar content (shared between desktop and Sheet) ───────────────────────

interface SidebarContentProps {
  collapsed: boolean;
  lang: Lang;
  isGuest: boolean;
  platformMode: string;
  onPlatformModeChange: (v: string | null) => void;
  history: AnalysisResult[];
  historyLoading: boolean;
  onHistorySelect: (item: AnalysisResult) => void;
  onNewAnalysis: () => void;
  showCollapseToggle?: boolean;
  onCollapse?: () => void;
}

function SidebarContent({
  collapsed,
  lang,
  isGuest,
  platformMode,
  onPlatformModeChange,
  history,
  historyLoading,
  onHistorySelect,
  onNewAnalysis,
  showCollapseToggle,
  onCollapse,
}: SidebarContentProps) {
  const t = LABELS[lang];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className={cn(
        "flex h-14 shrink-0 items-center border-b border-border/60 px-3 gap-2",
        collapsed ? "justify-center" : "justify-between",
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold tracking-tight text-foreground truncate">SierraLogic</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">AI</span>
          </div>
        )}
        {showCollapseToggle && (
          <Button variant="ghost" size="icon" onClick={onCollapse} className="shrink-0 text-muted-foreground hover:text-foreground">
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Analysis button */}
      <div className={cn("shrink-0 px-3 py-3", collapsed && "flex justify-center px-2")}>
        {collapsed ? (
          <button
            onClick={onNewAnalysis}
            title="New Analysis"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onNewAnalysis}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t.newAnalysis}
          </button>
        )}
      </div>

      {/* Scrollable middle section */}
      <div className={cn(
        "flex flex-1 flex-col gap-3 overflow-y-auto p-3",
        // Slim modern scrollbar
        "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
        "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
      )}>
        {/* Platform Mode */}
        {!collapsed && (
          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {t.platformMode}
            </p>
            <Select value={platformMode} onValueChange={onPlatformModeChange}>
              <SelectTrigger className="w-full text-xs h-9 bg-background/50 border-border/60">
                <Layers className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <Layers className="h-4 w-4 text-muted-foreground/60" />
          </div>
        )}

        {/* Battle Mode shortcut */}
        <Link
          href="/compare"
          className={cn(
            "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2",
            "text-xs font-medium text-muted-foreground",
            "transition-all duration-150 hover:border-violet-400/40 hover:bg-violet-500/8 hover:text-violet-400",
            collapsed && "justify-center px-2",
          )}
          title="Battle Mode — compare two sites"
        >
          <Swords className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Battle Mode</span>}
        </Link>

        {/* Agency Lead Machine shortcut */}
        <Link
          href="/agency"
          className={cn(
            "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2",
            "text-xs font-medium text-muted-foreground",
            "transition-all duration-150 hover:border-violet-400/40 hover:bg-violet-500/8 hover:text-violet-400",
            collapsed && "justify-center px-2",
          )}
          title="Agency Lead Machine"
        >
          <Briefcase className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Agency</span>}
        </Link>

        {/* Tasks inspiration page shortcut */}
        <Link
          href="/tasks"
          className={cn(
            "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2",
            "text-xs font-medium text-muted-foreground",
            "transition-all duration-150 hover:border-indigo-400/40 hover:bg-indigo-500/8 hover:text-indigo-400",
            collapsed && "justify-center px-2",
          )}
          title="AI Action Plan"
        >
          <ListChecks className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>{t.actionPlan}</span>}
        </Link>

        {/* Recent analyses divider */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 border-t border-border/50" />
          {!collapsed && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">
              {t.recentAnalyses}
            </span>
          )}
          <div className="flex-1 border-t border-border/50" />
        </div>

        {/* Content: Tips for guests, History for logged-in users */}
        {isGuest ? (
          !collapsed && (
            <div className="flex flex-col gap-2">
              {TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="mr-1.5">{tip.icon}</span>
                  {tip[lang]}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-0.5">
            {historyLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-2.5">
                  <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  {!collapsed && <Skeleton className="h-3 flex-1 rounded" />}
                </div>
              ))
            ) : history.length === 0 ? (
              !collapsed && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground/60">{t.noHistory}</p>
              )
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onHistorySelect(item)}
                  title={item.url}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left",
                    "transition-all duration-150",
                    "hover:bg-accent/60 hover:shadow-sm",
                  )}
                >
                  <span className={cn(
                    "h-2 w-2 shrink-0 rounded-full transition-transform group-hover:scale-110",
                    SENTIMENT_CONFIG[item.sentiment].dot,
                  )} />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground group-hover:text-foreground">
                        {item.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </span>
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pinned bottom — profile (auth) or Sign-in CTA (guest) */}
      {isGuest ? (
        !collapsed && (
          <div className="shrink-0 border-t border-border p-3">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 0 1px rgba(99,102,241,0.2)",
                  "0 0 14px 3px rgba(99,102,241,0.4)",
                  "0 0 0 1px rgba(99,102,241,0.2)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-muted/40 p-3"
            >
              <p className="mb-1 text-xs font-semibold text-foreground">{t.signInToSave}</p>
              <p className="mb-3 text-xs text-muted-foreground">{t.guestModeNote}</p>
              <Link
                href="/login"
                className="flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t.signIn}
              </Link>
            </motion.div>
          </div>
        )
      ) : (
        <SidebarProfile collapsed={collapsed} lang={lang} />
      )}
    </div>
  );
}

// ─── App header ───────────────────────────────────────────────────────────────

function AppHeader({
  onMenuClick,
  activeContext,
}: {
  onMenuClick:    () => void;
  activeContext?: string;
}) {
  const { status } = useSession();
  const { lang }   = useLang();
  const t          = LABELS[lang];

  return (
    <header className={cn(
      "flex h-14 shrink-0 items-center gap-3 px-4",
      "border-b border-white/20 dark:border-white/10",
      "bg-white/30 dark:bg-black/20 backdrop-blur-2xl",
      "shadow-[0_1px_0_rgba(255,255,255,0.08)]",
    )}>
      {/* Mobile-only sidebar toggle */}
      <Button
        variant="ghost" size="icon"
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
        className="shrink-0 text-muted-foreground hover:text-foreground md:hidden"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* Brand — mobile only */}
      <span className="font-bold tracking-tight text-foreground md:hidden">SierraLogic</span>

      {/* Dynamic context badge — center */}
      <div className="hidden flex-1 items-center justify-center sm:flex">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeContext ?? "__idle__"}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex max-w-[320px] items-center gap-2"
          >
            {activeContext ? (
              <>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                <span className="truncate text-sm font-medium text-foreground/70">
                  {activeContext}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground/35">{t.newAnalysis}</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeToggle />

        {/* Auth action */}
        {status === "authenticated" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            {t.signOut}
          </Button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-8 items-center rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            {t.signIn}
          </Link>
        )}
      </div>
    </header>
  );
}

// GlowingLoader removed — loading state is now communicated via input glow

function ErrorBanner({ prefix, message }: { prefix: string; message: string }) {
  return (
    <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span className="font-medium">{prefix}:</span> {message}
    </div>
  );
}

// ─── Analysis panel ───────────────────────────────────────────────────────────

// ── Sentiment score gauge ─────────────────────────────────────────────────────

function SentimentGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 67 ? "bg-emerald-500"
    : score >= 34 ? "bg-amber-500"
    : "bg-rose-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className="font-bold tabular-nums text-foreground">{score}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Analytics modal ───────────────────────────────────────────────────────────

function AnalyticsModal({ result, onClose }: { result: AnalysisResult; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="analytics-backdrop"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      {/* Modal */}
      <motion.div
        key="analytics-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-indigo-500" />
              <h2 className="text-base font-bold">Detailed Analytics</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Charts */}
          <div className="p-6">
            <AnalyticsCharts result={result} />
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Analysis panel ────────────────────────────────────────────────────────────

function AnalysisPanel({
  result,
  lang,
  scrapedText,
  tasks,
}: {
  result:       AnalysisResult;
  lang:         Lang;
  scrapedText?: string;
  tasks:        TaskItem[] | null; // null = guest (tab hidden)
}) {
  const t = LABELS[lang];
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showChat,      setShowChat]      = useState(false);
  const hasEnrichedData = result.sentimentScore !== undefined;
  const canChat = !!scrapedText;

  return (
    <>
      {/* pb-36: keeps the floating search bar from hiding the bottom of any tab */}
      <div className="mt-8 space-y-5 pb-36">

        {/* URL + sentiment pill */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="truncate font-mono text-xs">{result.url}</span>
          </div>
          <SentimentPill sentiment={result.sentiment} lang={lang} />
        </div>

        {/* Category + design style */}
        {(result.category || result.designStyle) && (
          <div className="flex flex-wrap items-center gap-2">
            {result.category && (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20">
                {result.category}
              </span>
            )}
            {result.designStyle && (
              <span className="text-xs text-muted-foreground">
                {result.designStyle}
              </span>
            )}
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">{t.overview}</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">{t.seoKeywords}</TabsTrigger>
            {result.boardOfDirectors && (
              <TabsTrigger value="board" className="flex-1">{t.aiBoard}</TabsTrigger>
            )}
            {tasks !== null && (
              <TabsTrigger value="action-plan" className="flex-1">📋 {t.actionPlan}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {/* Centred, max-width container keeps both panels readable at any screen width */}
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">

              {/* Summary glass panel */}
              <div className={cn(
                "rounded-2xl border p-5 space-y-3",
                "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-2xl",
                "border-white/30 dark:border-white/10",
                "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.10)]",
                "transition-shadow duration-300 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.16)]",
              )}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t.summary}
                </p>
                <p className="text-sm leading-relaxed text-foreground/80">{result.summary}</p>
                {result.sentimentScore !== undefined && (
                  <SentimentGauge score={result.sentimentScore} label={t.sentimentScore} />
                )}
              </div>

              {/* Topics glass panel */}
              <div className={cn(
                "rounded-2xl border p-5",
                "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-2xl",
                "border-white/30 dark:border-white/10",
                "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.10)]",
                "transition-shadow duration-300 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.16)]",
              )}>
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t.mainTopics}
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.topics.map((topic) => (
                    <span
                      key={topic}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        "bg-white/20 dark:bg-white/8 border border-white/30 dark:border-white/10",
                        "text-foreground/80 transition-colors duration-200",
                        "hover:bg-white/35 dark:hover:bg-white/15",
                      )}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="seo" className="mt-4">
            <div className="w-full max-w-3xl mx-auto">
              <div className={cn(
                "rounded-2xl border p-5",
                "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-2xl",
                "border-white/30 dark:border-white/10",
                "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.10)]",
                "transition-shadow duration-300 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.16)]",
              )}>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t.topKeywords}
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((kw) => (
                    <span
                      key={kw}
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-medium",
                        "bg-white/20 dark:bg-white/8 border border-white/30 dark:border-white/10",
                        "text-foreground/80 transition-colors duration-200",
                        "hover:bg-white/35 dark:hover:bg-white/15",
                      )}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {result.boardOfDirectors && (
            <TabsContent value="board" className="mt-4">
              <BoardOfDirectors data={result.boardOfDirectors} lang={lang} />
            </TabsContent>
          )}

          {tasks !== null && (
            <TabsContent value="action-plan" className="mt-4">
              {tasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t.noTasksYet}
                </p>
              ) : (
                <KanbanBoard initialTasks={tasks} lang={lang} />
              )}
            </TabsContent>
          )}
        </Tabs>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground/60">
            {t.analyzed} {new Date(result.createdAt).toLocaleString()}
          </p>
          {/* Action buttons row */}
          <div className="flex gap-2">
            {hasEnrichedData && (
              <button
                onClick={() => setShowAnalytics(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                {t.detailedAnalytics}
              </button>
            )}
            {canChat && (
              <button
                onClick={() => setShowChat((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  showChat
                    ? "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/30 dark:text-violet-300"
                    : "border-violet-200 bg-violet-50/60 text-violet-600 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/50",
                )}
              >
                💬 {showChat ? t.closeChat : t.chatWithWebsite}
              </button>
            )}
          </div>
        </div>

        {/* Inline chat panel */}
        <AnimatePresence>
          {showChat && scrapedText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <WebsiteChat websiteContext={scrapedText} websiteUrl={result.url} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Analytics modal */}
      <AnimatePresence>
        {showAnalytics && (
          <AnalyticsModal result={result} onClose={() => setShowAnalytics(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Battle result panel ──────────────────────────────────────────────────────

function hn(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function BattleResultPanel({ result, lang }: { result: CompareResult; lang: Lang }) {
  const t = LABELS[lang];
  const s1 = hn(result.site1Url);
  const s2 = hn(result.site2Url);
  return (
    <div className="mt-8 space-y-4">
      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.competitiveRadar}
        </p>
        <BattleChart data={result.radarData} site1Label={s1} site2Label={s2} />
      </div>

      {/* Verdict */}
      <div className="rounded-2xl border border-violet-500/30 bg-violet-950/15 p-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-300">
          <Trophy className="h-4 w-4" /> {t.verdict}
        </p>
        <p className="text-sm leading-relaxed text-foreground">{result.verdict}</p>
      </div>

      {/* Strengths + Advice */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Site 1 */}
        <div className="rounded-2xl border border-indigo-500/25 bg-card p-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
            {s1}
          </p>
          <ul className="space-y-1.5">
            {result.site1Strengths.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Site 2 */}
        <div className="rounded-2xl border border-emerald-500/25 bg-card p-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {s2}
          </p>
          <ul className="space-y-1.5">
            {result.site2Strengths.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Advice */}
        <div className="rounded-2xl border border-amber-500/25 bg-card p-4">
          <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Lightbulb className="h-3.5 w-3.5" /> {t.advice}
          </p>
          <ul className="space-y-1.5">
            {result.actionableAdvice.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground/50">
        {t.analyzed} {new Date().toLocaleString()}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // — Analyzer state
  const [url1, setUrl1]               = useState("");
  const [url2, setUrl2]               = useState("");
  const [isBattleMode, setIsBattleMode]   = useState(false);
  const [isVisionMode, setIsVisionMode]   = useState(false);
  const [visionResult, setVisionResult]   = useState<VisionResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [scrapedText, setScrapedText] = useState<string>("");
  const [error, setError]             = useState<string | null>(null);

  // — History state
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // — Tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // — Auth + language
  const { status } = useSession();
  const isGuest    = status === "unauthenticated";
  const { lang: uiLang } = useLang();
  const t = LABELS[uiLang];

  // — Layout / preference state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [platformMode, setPlatformMode] = useState<string>("standard");

  // — History fetch
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data: ApiResponse<AnalysisResult[]> = await res.json();
      if (data.success && data.data) setHistory(data.data);
    } catch { /* non-critical */ }
    finally { setHistoryLoading(false); }
  }, []);

  // — Tasks fetch (auth only)
  const fetchTasks = useCallback(async () => {
    if (isGuest) return;
    try {
      const res  = await fetch("/api/tasks");
      const data: ApiResponse<TaskItem[]> = await res.json();
      if (data.success && data.data) setTasks(data.data);
    } catch { /* non-critical */ }
  }, [isGuest]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchHistory(); }, [fetchHistory]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchTasks();   }, [fetchTasks]);

  // — Toggle battle mode (mutually exclusive with vision)
  function toggleBattleMode() {
    setIsBattleMode((v) => {
      const next = !v;
      setError(null);
      if (next) {
        setResult(null);
        setScrapedText("");
        setVisionResult(null);
        setIsVisionMode(false);
      } else {
        setUrl2("");
        setCompareResult(null);
      }
      return next;
    });
  }

  // — Toggle vision mode (mutually exclusive with battle)
  function toggleVisionMode() {
    setIsVisionMode((v) => {
      const next = !v;
      setError(null);
      if (next) {
        setResult(null);
        setScrapedText("");
        setCompareResult(null);
        setIsBattleMode(false);
        setUrl2("");
      } else {
        setVisionResult(null);
      }
      return next;
    });
  }

  // — Analyze (standard / battle / vision)
  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    if (isVisionMode) {
      if (!url1.trim()) { setLoading(false); return; }
      setVisionResult(null);
      try {
        const res  = await fetch("/api/analyze/vision", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: url1.trim(), language: LANG_NAMES[uiLang] }),
        });
        const data: ApiResponse<VisionResult> = await res.json();
        if (data.success && data.data) {
          setVisionResult(data.data);
        } else {
          setError(data.error ?? t.analysisFailed);
        }
      } catch {
        setError(t.networkError);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isBattleMode) {
      if (!url1.trim() || !url2.trim()) { setLoading(false); return; }
      setCompareResult(null);
      try {
        const res = await fetch("/api/analyze/compare", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url1: url1.trim(), url2: url2.trim() }),
        });
        const data: ApiResponse<CompareResult> = await res.json();
        if (data.success && data.data) {
          setCompareResult(data.data);
        } else {
          setError(data.error ?? t.analysisFailed);
        }
      } catch {
        setError(t.networkError);
      } finally {
        setLoading(false);
      }
    } else {
      if (!url1.trim()) { setLoading(false); return; }
      setResult(null);
      try {
        const res = await fetch("/api/analyze", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: url1.trim(), language: LANG_NAMES[uiLang] }),
        });
        const data: ApiResponse<AnalysisResult> = await res.json();
        if (data.success && data.data) {
          setResult(data.data);
          setScrapedText(data.data.scrapedText ?? "");
          void fetchHistory();
          void fetchTasks();
        } else {
          setError(data.error ?? t.analysisFailed);
        }
      } catch {
        setError(t.networkError);
      } finally {
        setLoading(false);
      }
    }
  }

  function handleNewAnalysis() {
    setResult(null);
    setCompareResult(null);
    setVisionResult(null);
    setUrl1("");
    setUrl2("");
    setError(null);
    setScrapedText("");
    setIsBattleMode(false);
    setIsVisionMode(false);
    setMobileSheetOpen(false);
  }

  function handleHistorySelect(item: AnalysisResult) {
    setResult(item);
    setCompareResult(null);
    setUrl1(item.url);
    setError(null);
    setScrapedText(""); // history items don't carry scraped text
    setIsBattleMode(false);
    setMobileSheetOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // The active URL stripped of protocol — shown in header center and used for context
  const rawCtx  = compareResult
    ? `${compareResult.site1Url.replace(/^https?:\/\//, "").split("/")[0]} vs ${compareResult.site2Url.replace(/^https?:\/\//, "").split("/")[0]}`
    : (result?.url ?? url1.trim());
  const activeContext = rawCtx ? rawCtx.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined;

  const sidebarProps: SidebarContentProps = {
    collapsed: !sidebarOpen,
    lang: uiLang,
    isGuest,
    platformMode,
    onPlatformModeChange: (v) => v && setPlatformMode(v),
    history,
    historyLoading,
    onHistorySelect: handleHistorySelect,
    onNewAnalysis: handleNewAnalysis,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Desktop sidebar — Framer Motion width animation */}
      <motion.aside
        animate={{ width: sidebarOpen ? 256 : 56 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "hidden md:flex flex-col overflow-hidden shrink-0",
          "border-r border-white/25 dark:border-white/10",
          "bg-white/40 dark:bg-black/30 backdrop-blur-2xl",
          "shadow-[1px_0_0_rgba(255,255,255,0.06)]",
        )}
      >
        <SidebarContent
          {...sidebarProps}
          showCollapseToggle
          onCollapse={() => setSidebarOpen((v) => !v)}
        />
      </motion.aside>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            {...sidebarProps}
            collapsed={false}
          />
        </SheetContent>
      </Sheet>

      {/* Right panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuClick={() => setMobileSheetOpen((v) => !v)}
          activeContext={activeContext}
        />

        {/* Main content — dynamic center-to-bottom layout */}
        <main className="relative flex-1 overflow-hidden">

          {/* Flex column — justify-center when idle, justify-end when active */}
          <div
            className={cn(
              "h-full flex flex-col",
              loading || result || compareResult || visionResult ? "justify-end" : "justify-center",
            )}
          >
            {/* Loading state — board skeleton or vision loading */}
            <AnimatePresence>
              {loading && !isBattleMode && (
                <motion.div
                  key={isVisionMode ? "vision-loading" : "board-loading"}
                  className="flex-1 overflow-y-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mx-auto max-w-3xl px-6 py-6">
                    {isVisionMode ? <VisionLoading /> : <BoardSkeleton lang={uiLang} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result panel — scrollable area above the pinned form */}
            <AnimatePresence>
              {!loading && (result || compareResult || visionResult) && (
                <motion.div
                  key={
                    visionResult    ? `vision-${visionResult.analyzedUrl}`
                    : compareResult ? `battle-${compareResult.site1Url}`
                    : result!.id
                  }
                  className="flex-1 overflow-y-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className={cn(
                    "py-6",
                    visionResult
                      ? "mx-auto max-w-5xl px-6"
                      : compareResult
                        ? "mx-auto max-w-4xl px-6"
                        : "w-full px-4 md:px-8",  // no max-w cap — AnalysisPanel controls its own widths
                  )}>
                    {visionResult
                      ? <VisionAudit result={visionResult} />
                      : compareResult
                        ? <BattleResultPanel result={compareResult} lang={uiLang} />
                        : result
                          ? <AnalysisPanel
                              result={result}
                              lang={uiLang}
                              scrapedText={scrapedText || undefined}
                              tasks={isGuest ? null : tasks}
                            />
                          : null
                    }
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search block — layout-animated center → bottom */}
            <motion.div
              layout
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="mx-auto w-full max-w-2xl shrink-0 px-6 py-8"
            >
              {/* Greeting + subtitle — exits when analysis starts */}
              <AnimatePresence>
                {!loading && !result && !compareResult && !visionResult && (
                  <motion.div
                    className="mb-8 text-center"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Greeting lang={uiLang} />
                    <p className="mt-3 text-base text-muted-foreground">{t.subtitle}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Command Center — flex-col squircle with toolbar */}
              <form onSubmit={handleAnalyze}>
                <motion.div
                  className={cn(
                    "flex flex-col overflow-hidden rounded-[2rem]",
                    "border border-white/35 dark:border-white/12",
                    "bg-white/50 dark:bg-black/30 backdrop-blur-2xl",
                    "shadow-[0_8px_32px_0_rgba(31,38,135,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]",
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
                  {/* Primary URL input */}
                  <input
                    type="url"
                    placeholder={isBattleMode ? t.battleUrl1 : t.urlPlaceholder}
                    value={url1}
                    onChange={(e) => setUrl1(e.target.value)}
                    disabled={loading}
                    className={cn(
                      "min-w-0 w-full bg-transparent",
                      "py-5 pl-7 pr-6",
                      "text-lg text-foreground",
                      "placeholder:text-muted-foreground/45 placeholder:font-light",
                      "outline-none border-none focus:outline-none",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  />

                  {/* Battle Mode: second URL input */}
                  <AnimatePresence>
                    {isBattleMode && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="mx-5 border-t border-border/40" />
                        <input
                          type="url"
                          placeholder={t.battleUrl2}
                          value={url2}
                          onChange={(e) => setUrl2(e.target.value)}
                          disabled={loading}
                          className={cn(
                            "min-w-0 w-full bg-transparent",
                            "py-5 pl-7 pr-6",
                            "text-lg text-foreground",
                            "placeholder:text-muted-foreground/45 placeholder:font-light",
                            "outline-none border-none focus:outline-none",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                          )}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Toolbar */}
                  <div className="flex items-center justify-between gap-2 border-t border-border/25 px-3 py-2">
                    {/* Left: mode toggles */}
                    <div className="flex items-center gap-1.5">
                      {/* Battle Mode */}
                      <button
                        type="button"
                        onClick={toggleBattleMode}
                        disabled={loading}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                          "text-xs font-medium transition-all duration-200",
                          isBattleMode
                            ? "bg-violet-600 text-white shadow-sm shadow-violet-500/30"
                            : "border border-border/60 text-muted-foreground hover:border-violet-400/60 hover:text-violet-400",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                        )}
                      >
                        <Swords className="h-3 w-3" />
                        {t.battleMode}
                      </button>

                      {/* Vision Mode */}
                      <button
                        type="button"
                        onClick={toggleVisionMode}
                        disabled={loading}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                          "text-xs font-medium transition-all duration-200",
                          isVisionMode
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                            : "border border-border/60 text-muted-foreground hover:border-indigo-400/60 hover:text-indigo-400",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                        )}
                      >
                        <Eye className="h-3 w-3" />
                        {t.visionMode ?? "AI Vision"}
                      </button>
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        (isBattleMode ? (!url1.trim() || !url2.trim()) : !url1.trim())
                      }
                      className={cn(
                        "rounded-[1.4rem] px-5 py-2.5",
                        isVisionMode
                          ? "bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/20"
                          : isBattleMode
                            ? "bg-violet-600 hover:bg-violet-700 shadow-sm shadow-violet-500/20"
                            : "bg-primary hover:opacity-90",
                        "text-primary-foreground text-sm font-semibold tracking-wide",
                        "transition-all duration-200",
                        "active:scale-[0.97]",
                        "disabled:opacity-35 disabled:cursor-not-allowed",
                        "inline-flex items-center gap-2",
                      )}
                    >
                      {loading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />
                          {isVisionMode ? (t.visionAnalyzing ?? "Analyzing…") : isBattleMode ? t.battling : t.analyzing}
                        </>
                      ) : isVisionMode ? (
                        <><Eye className="h-3.5 w-3.5" />{t.visionMode ?? "AI Vision"}</>
                      ) : isBattleMode ? (
                        <><Swords className="h-3.5 w-3.5" />{t.startBattle}</>
                      ) : (
                        t.analyze
                      )}
                    </button>
                  </div>
                </motion.div>
              </form>

              {/* Error — inline below form */}
              {error && <ErrorBanner prefix={t.errorPrefix} message={error} />}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
