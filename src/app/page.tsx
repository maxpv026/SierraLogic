"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, TrendingUp, TrendingDown, Minus, Globe,
  Sun, Moon, PanelLeft, ChevronRight, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { AnalysisResult, ApiResponse, Sentiment } from "@/types";

// ─── i18n labels ─────────────────────────────────────────────────────────────

type Lang = "en" | "uk" | "de" | "fr" | "pl";

const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    title: "Analyze any website instantly",
    subtitle: "Extract topics, sentiment, summary, and SEO keywords from any URL using GPT-4o mini.",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    urlPlaceholder: "https://example.com",
    targetLang: "Output language",
    platformMode: "Platform Mode",
    recentAnalyses: "Recent Analyses",
    noHistory: "No analyses yet — enter a URL above.",
    overview: "Overview",
    seoKeywords: "SEO Keywords",
    summary: "Summary",
    mainTopics: "Main Topics",
    topKeywords: "Top SEO Keywords",
    analyzed: "Analyzed",
    errorPrefix: "Error",
    networkError: "Network error — check your connection and try again.",
    analysisFailed: "Analysis failed — please try again.",
    uiLang: "Language",
  },
  uk: {
    title: "Аналізуйте будь-який сайт миттєво",
    subtitle: "Отримайте теми, тональність, резюме та SEO-ключові слова з будь-якого URL за допомогою GPT-4o mini.",
    analyze: "Аналізувати",
    analyzing: "Аналізую...",
    urlPlaceholder: "https://example.com",
    targetLang: "Мова результату",
    platformMode: "Режим платформи",
    recentAnalyses: "Останні аналізи",
    noHistory: "Аналізів поки немає — введіть URL вище.",
    overview: "Огляд",
    seoKeywords: "SEO-ключі",
    summary: "Резюме",
    mainTopics: "Основні теми",
    topKeywords: "Топ SEO-ключові слова",
    analyzed: "Проаналізовано",
    errorPrefix: "Помилка",
    networkError: "Помилка мережі — перевірте з'єднання.",
    analysisFailed: "Аналіз не вдався — спробуйте ще раз.",
    uiLang: "Мова інтерфейсу",
  },
  de: {
    title: "Analysieren Sie jede Website sofort",
    subtitle: "Extrahieren Sie Themen, Stimmung, Zusammenfassung und SEO-Keywords aus jeder URL mit GPT-4o mini.",
    analyze: "Analysieren",
    analyzing: "Analysiere...",
    urlPlaceholder: "https://example.com",
    targetLang: "Ausgabesprache",
    platformMode: "Plattformmodus",
    recentAnalyses: "Letzte Analysen",
    noHistory: "Noch keine Analysen — URL oben eingeben.",
    overview: "Übersicht",
    seoKeywords: "SEO-Keywords",
    summary: "Zusammenfassung",
    mainTopics: "Hauptthemen",
    topKeywords: "Top SEO-Keywords",
    analyzed: "Analysiert",
    errorPrefix: "Fehler",
    networkError: "Netzwerkfehler — Verbindung prüfen.",
    analysisFailed: "Analyse fehlgeschlagen — erneut versuchen.",
    uiLang: "Sprache",
  },
  fr: {
    title: "Analysez n'importe quel site instantanément",
    subtitle: "Extrayez sujets, sentiment, résumé et mots-clés SEO depuis n'importe quelle URL avec GPT-4o mini.",
    analyze: "Analyser",
    analyzing: "Analyse en cours...",
    urlPlaceholder: "https://example.com",
    targetLang: "Langue de sortie",
    platformMode: "Mode plateforme",
    recentAnalyses: "Analyses récentes",
    noHistory: "Aucune analyse — saisissez une URL.",
    overview: "Vue d'ensemble",
    seoKeywords: "Mots-clés SEO",
    summary: "Résumé",
    mainTopics: "Thèmes principaux",
    topKeywords: "Top mots-clés SEO",
    analyzed: "Analysé le",
    errorPrefix: "Erreur",
    networkError: "Erreur réseau — vérifiez votre connexion.",
    analysisFailed: "Analyse échouée — réessayez.",
    uiLang: "Langue",
  },
  pl: {
    title: "Analizuj każdą stronę natychmiastowo",
    subtitle: "Wydobądź tematy, sentyment, podsumowanie i słowa kluczowe SEO z dowolnego URL za pomocą GPT-4o mini.",
    analyze: "Analizuj",
    analyzing: "Analizuję...",
    urlPlaceholder: "https://example.com",
    targetLang: "Język wyniku",
    platformMode: "Tryb platformy",
    recentAnalyses: "Ostatnie analizy",
    noHistory: "Brak analiz — wpisz URL powyżej.",
    overview: "Przegląd",
    seoKeywords: "Słowa kluczowe SEO",
    summary: "Podsumowanie",
    mainTopics: "Główne tematy",
    topKeywords: "Top słowa kluczowe SEO",
    analyzed: "Przeanalizowano",
    errorPrefix: "Błąd",
    networkError: "Błąd sieci — sprawdź połączenie.",
    analysisFailed: "Analiza nie powiodła się — spróbuj ponownie.",
    uiLang: "Język",
  },
};

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
const LANG_NAMES: Record<Lang, string> = {
  en: "English", uk: "Ukrainian", de: "German", fr: "French", pl: "Polish",
};

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
  showCollapseToggle,
  onCollapse,
}: SidebarContentProps) {
  const t = LABELS[lang];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className={cn(
        "flex h-14 shrink-0 items-center border-b border-border px-3 gap-2",
        collapsed ? "justify-center" : "justify-between",
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold tracking-tight text-foreground truncate">SierraLogic</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">AI</span>
          </div>
        )}
        {showCollapseToggle && (
          <Button variant="ghost" size="icon" onClick={onCollapse} className="shrink-0">
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Scrollable middle section */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {/* Platform Mode */}
        {!collapsed && (
          <div className="space-y-1.5">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.platformMode}
            </p>
            <Select value={platformMode} onValueChange={onPlatformModeChange}>
              <SelectTrigger className="w-full text-sm">
                <Layers className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
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
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-border" />
          {!collapsed && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.recentAnalyses}</span>
          )}
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Content: Tips for guests, History for logged-in users */}
        {isGuest ? (
          !collapsed && (
            <div className="flex flex-col gap-2">
              {TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"
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
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-2">
                  <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
                  {!collapsed && <Skeleton className="h-3 flex-1" />}
                </div>
              ))
            ) : history.length === 0 ? (
              !collapsed && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t.noHistory}</p>
              )
            ) : (
              history.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => onHistorySelect(item)}
                  title={item.url}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      SENTIMENT_CONFIG[item.sentiment].dot,
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground group-hover:text-foreground">
                        {item.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </span>
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    </>
                  )}
                </motion.button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Guest CTA — pinned to sidebar bottom */}
      {isGuest && !collapsed && (
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
            <p className="mb-1 text-xs font-semibold text-foreground">Sign in to save history</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Analyses are not saved in guest mode.
            </p>
            <Link
              href="/login"
              className="flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── App header ───────────────────────────────────────────────────────────────

function AppHeader({
  onMenuClick,
  uiLang,
  onUiLangChange,
}: {
  onMenuClick: () => void;
  uiLang: Lang;
  onUiLangChange: (v: Lang) => void;
}) {
  const { status } = useSession();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Toggle sidebar">
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* Brand — shown on mobile where sidebar is hidden */}
      <span className="font-bold tracking-tight text-foreground md:hidden">SierraLogic</span>

      <div className="ml-auto flex items-center gap-2">
        {/* UI Language */}
        <Select value={uiLang} onValueChange={(v) => v && onUiLangChange(v as Lang)}>
          <SelectTrigger className="h-8 w-auto gap-1 text-xs border-none shadow-none bg-transparent focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="en">🇬🇧 EN</SelectItem>
            <SelectItem value="uk">🇺🇦 UA</SelectItem>
            <SelectItem value="de">🇩🇪 DE</SelectItem>
            <SelectItem value="fr">🇫🇷 FR</SelectItem>
            <SelectItem value="pl">🇵🇱 PL</SelectItem>
          </SelectContent>
        </Select>

        <ThemeToggle />

        {/* Auth action */}
        {status === "authenticated" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-8 items-center rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            Sign in
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

function AnalysisPanel({ result, lang }: { result: AnalysisResult; lang: Lang }) {
  const t = LABELS[lang];
  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4 shrink-0" />
          <span className="truncate font-mono text-xs">{result.url}</span>
        </div>
        <SentimentPill sentiment={result.sentiment} lang={lang} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">{t.overview}</TabsTrigger>
          <TabsTrigger value="seo" className="flex-1">{t.seoKeywords}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.summary}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/80">{result.summary}</p>
            </CardContent>
          </Card>
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.mainTopics}
            </p>
            <div className="flex flex-wrap gap-2">
              {result.topics.map((topic) => (
                <Badge key={topic} variant="secondary">{topic}</Badge>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.topKeywords}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((kw) => (
                  <Badge key={kw} variant="outline">{kw}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-right text-xs text-muted-foreground/60">
        {t.analyzed} {new Date(result.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // — Analyzer state
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // — History state
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // — Auth state
  const { status } = useSession();
  const isGuest = status === "unauthenticated";

  // — Layout / preference state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [platformMode, setPlatformMode] = useState<string>("standard");
  const [uiLang, setUiLang] = useState<Lang>("en");

  const t = LABELS[uiLang];

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

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  // — Analyze
  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), language: LANG_NAMES[uiLang] }),
      });
      const data: ApiResponse<AnalysisResult> = await res.json();

      if (data.success && data.data) {
        setResult(data.data);
        void fetchHistory();
      } else {
        setError(data.error ?? t.analysisFailed);
      }
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  function handleHistorySelect(item: AnalysisResult) {
    setResult(item);
    setUrl(item.url);
    setError(null);
    setMobileSheetOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sidebarProps: SidebarContentProps = {
    collapsed: !sidebarOpen,
    lang: uiLang,
    isGuest,
    platformMode,
    onPlatformModeChange: (v) => v && setPlatformMode(v),
    history,
    historyLoading,
    onHistorySelect: handleHistorySelect,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Desktop sidebar — Framer Motion width animation */}
      <motion.aside
        animate={{ width: sidebarOpen ? 256 : 56 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col border-r border-border bg-card overflow-hidden shrink-0"
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
          onMenuClick={() => {
            if (window.innerWidth >= 768) {
              setSidebarOpen((v) => !v);
            } else {
              setMobileSheetOpen((v) => !v);
            }
          }}
          uiLang={uiLang}
          onUiLangChange={setUiLang}
        />

        {/* Main content — dynamic center-to-bottom layout */}
        <main className="relative flex-1 overflow-hidden">

          {/* Flex column — justify-center when idle, justify-end when active */}
          <div
            className={cn(
              "h-full flex flex-col",
              loading || result ? "justify-end" : "justify-center",
            )}
          >
            {/* Result panel — scrollable area above the pinned form */}
            <AnimatePresence>
              {!loading && result && (
                <motion.div
                  key={result.id}
                  className="flex-1 overflow-y-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="mx-auto max-w-2xl px-6 py-6">
                    <AnalysisPanel result={result} lang={uiLang} />
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
                {!loading && !result && (
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

              {/* Form — input has glow when loading */}
              <form onSubmit={handleAnalyze} className="flex flex-col gap-2 sm:flex-row">
                <motion.div
                  className="flex-1 rounded-md"
                  animate={loading ? {
                    boxShadow: [
                      "0 0 0 2px rgba(99,102,241,0.3)",
                      "0 0 20px 5px rgba(99,102,241,0.5)",
                      "0 0 0 2px rgba(99,102,241,0.3)",
                    ],
                  } : {
                    boxShadow: "0 0 0 0px rgba(99,102,241,0)",
                  }}
                  transition={loading
                    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.4 }
                  }
                >
                  <Input
                    type="url"
                    placeholder={t.urlPlaceholder}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                    className="w-full"
                    required
                  />
                </motion.div>
                <Button type="submit" disabled={loading || !url.trim()} className="shrink-0">
                  {loading ? t.analyzing : t.analyze}
                </Button>
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
