"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Briefcase, Lock, Sparkles, Loader2,
  Copy, CheckCheck, CheckCircle2, Circle, Star,
  AlertTriangle, Trash2, RefreshCw,
} from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import type { AgencyLead, LeadStatus } from "@/types";

// ─── Translations ─────────────────────────────────────────────────────────────

type Lang = "en" | "uk" | "de" | "fr" | "pl";

interface AgencyT {
  back: string;
  title: string;
  generateTitle: string;
  generateDesc: string;
  generateBtn: string;
  progressSteps: [string, string, string, string];
  pipelineTitle: string;
  emptyState: string;
  statusDraft: string;
  statusContacted: string;
  statusConverted: string;
  showLess: string;
  showMore: string;
  copied: string;
  copyEmail: string;
  markContacted: string;
  markConverted: string;
  reset: string;
  errorStatus: string;
  errorDelete: string;
  paywallTitle: string;
  paywallPremium: string;
  paywallDesc: string;
  paywallFeatures: [string, string, string, string];
  paywallUpgrade: string;
  paywallBack: string;
}

const AGENCY_LABELS: Record<Lang, AgencyT> = {
  en: {
    back: "Back",
    title: "Agency Lead Machine",
    generateTitle: "Generate Leads",
    generateDesc: "Paste competitor or prospect URLs (one per line, max 10). The AI will audit each site and write a personalised cold email for you.",
    generateBtn: "Generate Leads",
    progressSteps: ["Scraping websites…", "AI auditing each site…", "Writing cold emails…", "Saving to your pipeline…"],
    pipelineTitle: "Lead Pipeline",
    emptyState: "No leads yet. Paste some URLs above and click Generate Leads.",
    statusDraft: "Draft",
    statusContacted: "Contacted",
    statusConverted: "Converted",
    showLess: "Show less",
    showMore: "Show full email →",
    copied: "Copied!",
    copyEmail: "Copy Email",
    markContacted: "Mark Contacted",
    markConverted: "Mark Converted",
    reset: "Reset",
    errorStatus: "Failed to update lead status.",
    errorDelete: "Failed to delete lead.",
    paywallTitle: "Agency Lead Machine",
    paywallPremium: "Premium Feature",
    paywallDesc: "Bulk-analyze competitor websites, identify their critical flaws, and auto-generate highly personalized cold emails. Close more deals on autopilot.",
    paywallFeatures: ["Analyze up to 10 URLs per batch", "AI-powered flaw detection", "Personalized cold email generation", "CRM pipeline with status tracking"],
    paywallUpgrade: "Upgrade to Max ($49/mo)",
    paywallBack: "← Back to SierraLogic",
  },
  uk: {
    back: "Назад",
    title: "Машина лідогенерації",
    generateTitle: "Генерувати ліди",
    generateDesc: "Вставте URL конкурентів або потенційних клієнтів (по одному на рядок, макс. 10). AI проаудіює кожен сайт і напише персоналізований холодний лист.",
    generateBtn: "Генерувати ліди",
    progressSteps: ["Сканування сайтів…", "AI аналізує кожен сайт…", "Написання холодних листів…", "Збереження до пайплайну…"],
    pipelineTitle: "Пайплайн лідів",
    emptyState: "Ще немає лідів. Вставте URL вище та натисніть «Генерувати ліди».",
    statusDraft: "Чернетка",
    statusContacted: "Зв'язались",
    statusConverted: "Конвертовано",
    showLess: "Показати менше",
    showMore: "Повний лист →",
    copied: "Скопійовано!",
    copyEmail: "Скопіювати лист",
    markContacted: "Зв'язались",
    markConverted: "Конвертовано",
    reset: "Скинути",
    errorStatus: "Не вдалося оновити статус ліда.",
    errorDelete: "Не вдалося видалити лід.",
    paywallTitle: "Машина лідогенерації",
    paywallPremium: "Преміум функція",
    paywallDesc: "Масовий аналіз сайтів конкурентів, виявлення критичних недоліків та автоматична генерація персоналізованих холодних листів.",
    paywallFeatures: ["До 10 URL за один раз", "Виявлення недоліків за допомогою AI", "Персоналізовані холодні листи", "CRM-пайплайн зі статусами"],
    paywallUpgrade: "Оновити до Max ($49/міс)",
    paywallBack: "← Назад до SierraLogic",
  },
  de: {
    back: "Zurück",
    title: "Agency Lead Machine",
    generateTitle: "Leads generieren",
    generateDesc: "Fügen Sie Konkurrenz- oder Interessenten-URLs ein (eine pro Zeile, max. 10). KI prüft jede Seite und schreibt eine personalisierte Kalt-E-Mail.",
    generateBtn: "Leads generieren",
    progressSteps: ["Websites scrapen…", "KI prüft jede Seite…", "Kalt-E-Mails schreiben…", "In Pipeline speichern…"],
    pipelineTitle: "Lead-Pipeline",
    emptyState: "Noch keine Leads. URLs oben einfügen und auf «Leads generieren» klicken.",
    statusDraft: "Entwurf",
    statusContacted: "Kontaktiert",
    statusConverted: "Konvertiert",
    showLess: "Weniger anzeigen",
    showMore: "Vollständige E-Mail →",
    copied: "Kopiert!",
    copyEmail: "E-Mail kopieren",
    markContacted: "Als Kontaktiert markieren",
    markConverted: "Als Konvertiert markieren",
    reset: "Zurücksetzen",
    errorStatus: "Status konnte nicht aktualisiert werden.",
    errorDelete: "Lead konnte nicht gelöscht werden.",
    paywallTitle: "Agency Lead Machine",
    paywallPremium: "Premium-Funktion",
    paywallDesc: "Analysieren Sie Websites von Mitbewerbern, erkennen Sie kritische Schwächen und generieren Sie automatisch personalisierte Kalt-E-Mails.",
    paywallFeatures: ["Bis zu 10 URLs pro Batch", "KI-gestützte Fehlererkennung", "Personalisierte Kalt-E-Mails", "CRM-Pipeline mit Statusverfolgung"],
    paywallUpgrade: "Auf Max upgraden ($49/Mo)",
    paywallBack: "← Zurück zu SierraLogic",
  },
  fr: {
    back: "Retour",
    title: "Agency Lead Machine",
    generateTitle: "Générer des leads",
    generateDesc: "Collez les URLs de concurrents ou de prospects (une par ligne, max 10). L'IA audite chaque site et rédige un email personnalisé.",
    generateBtn: "Générer des leads",
    progressSteps: ["Scraping des sites…", "L'IA audite chaque site…", "Rédaction des emails…", "Enregistrement dans le pipeline…"],
    pipelineTitle: "Pipeline de leads",
    emptyState: "Aucun lead pour l'instant. Collez des URLs ci-dessus et cliquez sur «Générer des leads».",
    statusDraft: "Brouillon",
    statusContacted: "Contacté",
    statusConverted: "Converti",
    showLess: "Afficher moins",
    showMore: "Email complet →",
    copied: "Copié !",
    copyEmail: "Copier l'email",
    markContacted: "Marquer Contacté",
    markConverted: "Marquer Converti",
    reset: "Réinitialiser",
    errorStatus: "Impossible de mettre à jour le statut.",
    errorDelete: "Impossible de supprimer le lead.",
    paywallTitle: "Agency Lead Machine",
    paywallPremium: "Fonctionnalité Premium",
    paywallDesc: "Analysez en masse les sites des concurrents, identifiez leurs failles critiques et générez automatiquement des emails personnalisés.",
    paywallFeatures: ["Jusqu'à 10 URLs par lot", "Détection de failles par IA", "Emails froids personnalisés", "Pipeline CRM avec suivi"],
    paywallUpgrade: "Passer à Max ($49/mois)",
    paywallBack: "← Retour à SierraLogic",
  },
  pl: {
    back: "Wróć",
    title: "Maszyna do pozyskiwania leadów",
    generateTitle: "Generuj leady",
    generateDesc: "Wklej adresy URL konkurentów lub potencjalnych klientów (jeden na linię, maks. 10). AI zbada każdą stronę i napisze spersonalizowany cold mail.",
    generateBtn: "Generuj leady",
    progressSteps: ["Scrapowanie stron…", "AI analizuje każdą stronę…", "Pisanie cold maili…", "Zapisywanie do pipeline'u…"],
    pipelineTitle: "Pipeline leadów",
    emptyState: "Brak leadów. Wklej URL-e powyżej i kliknij «Generuj leady».",
    statusDraft: "Szkic",
    statusContacted: "Skontaktowano",
    statusConverted: "Skonwertowano",
    showLess: "Pokaż mniej",
    showMore: "Pełny email →",
    copied: "Skopiowano!",
    copyEmail: "Kopiuj email",
    markContacted: "Oznacz Skontaktowany",
    markConverted: "Oznacz Skonwertowany",
    reset: "Resetuj",
    errorStatus: "Nie udało się zaktualizować statusu.",
    errorDelete: "Nie udało się usunąć leada.",
    paywallTitle: "Maszyna do pozyskiwania leadów",
    paywallPremium: "Funkcja Premium",
    paywallDesc: "Masowa analiza stron konkurentów, wykrywanie krytycznych błędów i automatyczne generowanie spersonalizowanych cold maili.",
    paywallFeatures: ["Do 10 URL na raz", "Wykrywanie błędów przez AI", "Spersonalizowane cold maile", "Pipeline CRM ze śledzeniem statusu"],
    paywallUpgrade: "Ulepsz do Max ($49/mies)",
    paywallBack: "← Powrót do SierraLogic",
  },
} satisfies Record<Lang, AgencyT>;

function useAgencyT(): AgencyT {
  const { lang } = useLang();
  return AGENCY_LABELS[(lang as Lang) in AGENCY_LABELS ? (lang as Lang) : "en"];
}

// ─── Status meta (styles only — labels come from translations) ────────────────

const STATUS_META: Record<LeadStatus, { className: string; next: LeadStatus }> = {
  DRAFT:     { className: "bg-slate-500/10 text-slate-400 border-slate-500/20",   next: "CONTACTED" },
  CONTACTED: { className: "bg-blue-500/10 text-blue-400 border-blue-500/20",     next: "CONVERTED" },
  CONVERTED: { className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", next: "DRAFT" },
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

function GeneratingProgress({ urlCount, onDone }: { urlCount: number; onDone: boolean }) {
  const t = useAgencyT();
  const [pct, setPct]   = useState(0);
  const [step, setStep] = useState(0);
  const duration         = Math.max(urlCount * 9_000, 12_000);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (onDone) { setPct(100); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const raw = (elapsed / duration) * 90;
      setPct(Math.min(raw, 89));
      setStep(Math.min(Math.floor(raw / 25), 3));
    }, 120);
    return () => clearInterval(id);
  }, [onDone, duration]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{t.progressSteps[step]}</span>
        <span className="tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.15 }}
        />
      </div>
      <div className="space-y-2">
        {t.progressSteps.map((s, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2.5 text-xs"
            animate={{ opacity: i <= step ? 1 : 0.3 }}
          >
            {i < step ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : i === step ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-400" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
            )}
            <span className={i === step ? "text-foreground font-medium" : "text-muted-foreground"}>
              {s}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Lead card ────────────────────────────────────────────────────────────────

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function LeadCard({
  lead,
  onStatusChange,
  onDelete,
}: {
  lead:           AgencyLead;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onDelete:       (id: string) => void;
}) {
  const t = useAgencyT();
  const [copied,   setCopied]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[lead.status];

  // Translated status label
  const statusLabel = lead.status === "DRAFT"
    ? t.statusDraft
    : lead.status === "CONTACTED"
      ? t.statusContacted
      : t.statusConverted;

  async function copyEmail() {
    await navigator.clipboard.writeText(lead.coldEmailDraft).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_200);
  }

  async function advanceStatus() {
    const next = meta.next;
    onStatusChange(lead.id, next);
    try {
      const res = await fetch(`/api/agency/leads/${lead.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      onStatusChange(lead.id, lead.status);
      toast.error(t.errorStatus);
    }
  }

  async function deleteLead() {
    onDelete(lead.id);
    try {
      await fetch(`/api/agency/leads/${lead.id}`, { method: "DELETE" });
    } catch {
      toast.error(t.errorDelete);
    }
  }

  // AI-generated content: subject + body come directly from the localized DB record
  const subject   = lead.coldEmailDraft.match(/Subject:\s*(.+)/i)?.[1]?.trim() ?? "Cold outreach";
  const emailBody = lead.coldEmailDraft.replace(/Subject:.*\n?\n?/i, "").trim();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        "rounded-2xl border p-5 space-y-4",
        "bg-white/10 dark:bg-white/5 backdrop-blur-md",
        "border-white/20 dark:border-white/10",
        "shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)]",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {lead.companyName ?? hostname(lead.url)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{hostname(lead.url)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            meta.className,
          )}>
            {statusLabel}
          </span>
          <button
            onClick={deleteLead}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete lead"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI-generated flaw badges — content is localised by the AI */}
      <div className="flex flex-wrap gap-2">
        {lead.identifiedFlaws.map((flaw, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/8 px-2.5 py-1 text-xs text-amber-500 cursor-default"
            title={flaw.description}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {flaw.title}
          </div>
        ))}
      </div>

      {/* AI-generated email preview — content is localised by the AI */}
      <div className="rounded-xl border border-border/40 bg-background/30 px-4 py-3 text-xs space-y-1">
        <p className="font-semibold text-foreground/80">{subject}</p>
        <p className={cn("leading-relaxed text-muted-foreground", !expanded && "line-clamp-3")}>
          {emailBody}
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {expanded ? t.showLess : t.showMore}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={copyEmail}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 px-3",
            "text-xs font-semibold border transition-all duration-200",
            copied
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border/50 bg-muted/30 text-foreground hover:bg-muted",
          )}
        >
          {copied
            ? <><CheckCheck className="h-3.5 w-3.5" />{t.copied}</>
            : <><Copy className="h-3.5 w-3.5" />{t.copyEmail}</>}
        </button>

        <button
          onClick={advanceStatus}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 px-3",
            "text-xs font-semibold border transition-all duration-200",
            lead.status === "CONTACTED"
              ? "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
              : lead.status === "CONVERTED"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20",
          )}
        >
          {lead.status === "DRAFT"     && <><CheckCircle2 className="h-3.5 w-3.5" />{t.markContacted}</>}
          {lead.status === "CONTACTED" && <><Star className="h-3.5 w-3.5" />{t.markConverted}</>}
          {lead.status === "CONVERTED" && <><RefreshCw className="h-3.5 w-3.5" />{t.reset}</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ leads }: { leads: AgencyLead[] }) {
  const t = useAgencyT();
  const draft     = leads.filter((l) => l.status === "DRAFT").length;
  const contacted = leads.filter((l) => l.status === "CONTACTED").length;
  const converted = leads.filter((l) => l.status === "CONVERTED").length;

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: t.statusDraft,     value: draft,     color: "text-slate-400"   },
        { label: t.statusContacted, value: contacted, color: "text-blue-400"    },
        { label: t.statusConverted, value: converted, color: "text-emerald-400" },
      ].map((s) => (
        <div key={s.label} className="rounded-xl border border-border/40 bg-white/5 dark:bg-white/3 backdrop-blur-sm p-3 text-center">
          <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Paywall ──────────────────────────────────────────────────────────────────

function Paywall() {
  const t = useAgencyT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "w-full max-w-md rounded-3xl border p-10 text-center",
          "bg-white/10 dark:bg-black/30 backdrop-blur-2xl",
          "border-white/20 dark:border-white/10",
          "shadow-[0_24px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)]",
        )}
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.2)]"
        >
          <Lock className="h-9 w-9 text-violet-400" />
        </motion.div>

        <div className="mb-2 flex items-center justify-center gap-2">
          <Briefcase className="h-5 w-5 text-violet-400" />
          <h1 className="text-xl font-bold text-foreground">{t.paywallTitle}</h1>
        </div>
        <p className="mb-2 text-sm font-medium text-violet-300">{t.paywallPremium}</p>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">{t.paywallDesc}</p>

        <ul className="mb-8 space-y-2 text-left text-sm text-muted-foreground">
          {t.paywallFeatures.map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href="/settings?tab=ai-usage"
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 px-6",
            "text-sm font-bold text-white",
            "bg-gradient-to-r from-violet-600 to-indigo-600",
            "shadow-[0_4px_20px_rgba(139,92,246,0.4)]",
            "transition-all hover:shadow-[0_4px_28px_rgba(139,92,246,0.55)] hover:opacity-95",
          )}
        >
          <Sparkles className="h-4 w-4" />
          {t.paywallUpgrade}
        </Link>

        <Link href="/" className="mt-4 block text-xs text-muted-foreground hover:text-foreground transition-colors">
          {t.paywallBack}
        </Link>
      </motion.div>
    </div>
  );
}

// ─── Agency dashboard ─────────────────────────────────────────────────────────

function AgencyDashboard() {
  const t = useAgencyT();
  const { lang } = useLang();

  const [urlInput,    setUrlInput]    = useState("");
  const [leads,       setLeads]       = useState<AgencyLead[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [fetchingOld, setFetchingOld] = useState(true);
  const [generating,  setGenerating]  = useState(false);
  const [urlCount,    setUrlCount]    = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/agency/leads")
      .then((r) => r.json())
      .then((d) => { if (d.success) setLeads(d.data); })
      .catch(() => {})
      .finally(() => setFetchingOld(false));
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const urls = urlInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) return;

    setUrlCount(urls.length);
    setLoading(true);
    setGenerating(true);

    try {
      const res  = await fetch("/api/agency/leads", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        // Include current UI language so AI generates content in that language
        body:    JSON.stringify({ urls, language: lang }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error ?? "Failed to generate leads");

      const { leads: newLeads, failCount } = data.data as { leads: AgencyLead[]; failCount: number };
      setLeads((prev) => [...newLeads, ...prev]);
      setUrlInput("");

      if (newLeads.length > 0) {
        toast.success(`${newLeads.length} lead${newLeads.length > 1 ? "s" : ""} generated!`);
      }
      if (failCount > 0) {
        toast.warning(`${failCount} URL${failCount > 1 ? "s" : ""} couldn't be scraped and were skipped.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }

  function handleStatusChange(id: string, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
  }

  function handleDelete(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-white/15 bg-white/20 dark:bg-black/20 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.back}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-foreground">{t.title}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {/* Input section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-3xl border p-6 space-y-5",
            "bg-white/10 dark:bg-white/5 backdrop-blur-xl",
            "border-white/20 dark:border-white/10",
            "shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
          )}
        >
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.generateTitle}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.generateDesc}</p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <textarea
              ref={textareaRef}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={loading}
              placeholder={"https://competitor-a.com\nhttps://competitor-b.com\nhttps://prospect-c.io"}
              rows={5}
              className={cn(
                "w-full resize-none rounded-2xl border px-5 py-4 font-mono text-sm",
                "bg-black/10 dark:bg-black/30 text-foreground",
                "border-white/20 dark:border-white/10",
                "placeholder:text-muted-foreground/40 placeholder:font-sans",
                "outline-none focus:ring-2 focus:ring-violet-500/30",
                "disabled:opacity-50",
              )}
            />

            {loading ? (
              <GeneratingProgress urlCount={urlCount} onDone={!generating} />
            ) : (
              <motion.button
                type="submit"
                disabled={!urlInput.trim()}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4",
                  "text-sm font-bold text-white",
                  "bg-gradient-to-r from-violet-600 to-indigo-600",
                  "shadow-[0_4px_20px_rgba(99,102,241,0.35)]",
                  "transition-all hover:shadow-[0_4px_28px_rgba(99,102,241,0.5)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
                )}
              >
                <Sparkles className="h-4 w-4" />
                {t.generateBtn}
              </motion.button>
            )}
          </form>
        </motion.div>

        {/* Pipeline */}
        {(leads.length > 0 || fetchingOld) && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-foreground">
              {t.pipelineTitle}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({leads.length})</span>
            </h2>

            {leads.length > 0 && <StatsBar leads={leads} />}

            {fetchingOld ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        )}

        {!fetchingOld && leads.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{t.emptyState}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page wrapper — plan gate ─────────────────────────────────────────────────

export default function AgencyPage() {
  const [plan,    setPlan]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/info")
      .then((r) => r.json())
      .then((d) => setPlan(d?.data?.plan ?? "FREE"))
      .catch(() => setPlan("FREE"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plan !== "MAX") return <Paywall />;
  return <AgencyDashboard />;
}
