"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n-context";
import type { BoardData } from "@/types";

type Lang = "en" | "uk" | "de" | "fr" | "pl";

// ─── Board title ──────────────────────────────────────────────────────────────

const BOARD_TITLE: Record<Lang, string> = {
  en: "AI Board of Directors",
  uk: "Рада директорів AI",
  de: "KI-Direktorium",
  fr: "Conseil d'administration IA",
  pl: "Rada Dyrektorów AI",
};

// ─── Localised field labels ───────────────────────────────────────────────────

interface FieldLabels {
  keywords:            string;
  technicalGaps:       string;
  optimizationPlan:    string;
  targetAudience:      string;
  toneOfVoice:         string;
  emotionalAppeal:     string;
  ctaEffectiveness:    string;
  navigationClarity:   string;
  userJourneyFriction: string;
  accessibilityIssues: string;
  designStyle:         string;
  // Agent sub-headings
  seoSubtitle: string;
  mktSubtitle: string;
  uxSubtitle:  string;
}

const FIELD_LABELS: Record<Lang, FieldLabels> = {
  en: {
    keywords:            "Keywords",
    technicalGaps:       "Technical Gaps",
    optimizationPlan:    "Optimization Plan",
    targetAudience:      "Target Audience",
    toneOfVoice:         "Tone of Voice",
    emotionalAppeal:     "Emotional Appeal",
    ctaEffectiveness:    "CTA Effectiveness",
    navigationClarity:   "Navigation Clarity",
    userJourneyFriction: "User Journey Friction",
    accessibilityIssues: "Accessibility Issues",
    designStyle:         "Design Style",
    seoSubtitle:         "Technical SEO",
    mktSubtitle:         "Marketing & Conversion",
    uxSubtitle:          "User Experience",
  },
  uk: {
    keywords:            "Ключові слова",
    technicalGaps:       "Технічні прогалини",
    optimizationPlan:    "План оптимізації",
    targetAudience:      "Цільова аудиторія",
    toneOfVoice:         "Тон комунікації",
    emotionalAppeal:     "Емоційний відгук",
    ctaEffectiveness:    "Ефективність CTA",
    navigationClarity:   "Чіткість навігації",
    userJourneyFriction: "Тертя у шляху користувача",
    accessibilityIssues: "Проблеми доступності",
    designStyle:         "Стиль дизайну",
    seoSubtitle:         "Технічне SEO",
    mktSubtitle:         "Маркетинг і конверсія",
    uxSubtitle:          "Користувацький досвід",
  },
  de: {
    keywords:            "Keywords",
    technicalGaps:       "Technische Lücken",
    optimizationPlan:    "Optimierungsplan",
    targetAudience:      "Zielgruppe",
    toneOfVoice:         "Tonalität",
    emotionalAppeal:     "Emotionale Wirkung",
    ctaEffectiveness:    "CTA-Wirksamkeit",
    navigationClarity:   "Navigationsklarheit",
    userJourneyFriction: "Reibungspunkte",
    accessibilityIssues: "Barrierefreiheit",
    designStyle:         "Designstil",
    seoSubtitle:         "Technisches SEO",
    mktSubtitle:         "Marketing & Conversion",
    uxSubtitle:          "User Experience",
  },
  fr: {
    keywords:            "Mots-clés",
    technicalGaps:       "Lacunes techniques",
    optimizationPlan:    "Plan d'optimisation",
    targetAudience:      "Public cible",
    toneOfVoice:         "Ton de voix",
    emotionalAppeal:     "Attrait émotionnel",
    ctaEffectiveness:    "Efficacité des CTA",
    navigationClarity:   "Clarté de navigation",
    userJourneyFriction: "Friction du parcours",
    accessibilityIssues: "Accessibilité",
    designStyle:         "Style de conception",
    seoSubtitle:         "SEO Technique",
    mktSubtitle:         "Marketing & Conversion",
    uxSubtitle:          "Expérience Utilisateur",
  },
  pl: {
    keywords:            "Słowa kluczowe",
    technicalGaps:       "Luki techniczne",
    optimizationPlan:    "Plan optymalizacji",
    targetAudience:      "Grupa docelowa",
    toneOfVoice:         "Ton komunikacji",
    emotionalAppeal:     "Apel emocjonalny",
    ctaEffectiveness:    "Skuteczność CTA",
    navigationClarity:   "Przejrzystość nawigacji",
    userJourneyFriction: "Tarcia w ścieżce",
    accessibilityIssues: "Dostępność",
    designStyle:         "Styl projektu",
    seoSubtitle:         "Techniczne SEO",
    mktSubtitle:         "Marketing i konwersja",
    uxSubtitle:          "Doświadczenie użytkownika",
  },
} satisfies Record<Lang, FieldLabels>;

// ─── Agent config ─────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id:         "seo" as const,
    emoji:      "👨‍💻",
    title:      "SEO Lead",
    scoreColor: "#818cf8",   // indigo-400 — vibrant on glass
    accentFrom: "from-indigo-500/30",
    accentTo:   "to-indigo-600/10",
    dotClass:   "bg-indigo-400",
    ringClass:  "ring-indigo-500/20",
    cyclingMsgs: ["Scanning metadata…", "Checking keyword density…", "Auditing technical gaps…"],
  },
  {
    id:         "marketing" as const,
    emoji:      "✍️",
    title:      "CMO",
    scoreColor: "#f472b6",   // pink-400
    accentFrom: "from-pink-500/30",
    accentTo:   "to-pink-600/10",
    dotClass:   "bg-pink-400",
    ringClass:  "ring-pink-500/20",
    cyclingMsgs: ["Reading the copy…", "Evaluating brand voice…", "Assessing CTAs…"],
  },
  {
    id:         "ux" as const,
    emoji:      "🕵️",
    title:      "UX Lead",
    scoreColor: "#34d399",   // emerald-400
    accentFrom: "from-emerald-500/30",
    accentTo:   "to-emerald-600/10",
    dotClass:   "bg-emerald-400",
    ringClass:  "ring-emerald-500/20",
    cyclingMsgs: ["Navigating the DOM…", "Identifying friction…", "Checking accessibility…"],
  },
] as const;

type AgentConfig = (typeof AGENTS)[number];

// ─── Shared glass card shell ──────────────────────────────────────────────────

// Liquid glass class used by every card
const GLASS = cn(
  "bg-white/10 dark:bg-zinc-900/20 backdrop-blur-xl",
  "border border-white/30 dark:border-white/10",
  "shadow-[0_8px_32px_0_rgba(0,0,0,0.10)]",
);

// ─── Circular score ring ──────────────────────────────────────────────────────

function CircularScore({ score, color }: { score: number; color: string }) {
  const size = 76;
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} fill="none"
          stroke="rgba(255,255,255,0.12)" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: "stroke-dasharray 1.3s ease", filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold tabular-nums leading-none text-foreground">{score}</span>
        <span className="mt-0.5 text-[9px] leading-none text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, dotClass }: { label: string; dotClass: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
      {label}
    </p>
  );
}

function InsightBlock({ label, value, dotClass }: { label: string; value: string; dotClass: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <SectionLabel label={label} dotClass={dotClass} />
      <p className="text-xs leading-relaxed text-foreground/75">{value}</p>
    </div>
  );
}

function TagCloud({ label, items, dotClass }: { label: string; items: string[]; dotClass: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <SectionLabel label={label} dotClass={dotClass} />
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]",
            "bg-white/20 dark:bg-white/8 border border-white/25 dark:border-white/10 text-foreground/80",
          )}>
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BulletList({ label, items, dotClass }: { label: string; items: string[]; dotClass: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <SectionLabel label={label} dotClass={dotClass} />
      <ul className="space-y-1">
        {items.map((g, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/75">
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
            {g}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Agent card header ────────────────────────────────────────────────────────

function AgentHeader({
  agent,
  subtitle,
  score,
}: {
  agent:    AgentConfig;
  subtitle: string;
  score:    number;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-t-[2rem] p-5",
      "bg-gradient-to-br", agent.accentFrom, agent.accentTo,
      "border-b border-white/15 dark:border-white/8",
    )}>
      <span className="text-2xl leading-none drop-shadow">{agent.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{agent.title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <CircularScore score={score} color={agent.scoreColor} />
    </div>
  );
}

// ─── Per-agent populated cards ────────────────────────────────────────────────

// Shared card shell: capped height + scrollable body so the card never exceeds 65vh
const CARD_SHELL = "flex flex-col rounded-[2rem] overflow-hidden max-h-[65vh]";
const CARD_BODY  = "flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 p-5 pr-3";

function SeoCard({
  agent, data, fl,
}: {
  agent: AgentConfig & { id: "seo" };
  data:  BoardData["seo"];
  fl:    FieldLabels;
}) {
  return (
    <div className={cn(CARD_SHELL, GLASS)}>
      <AgentHeader agent={agent} subtitle={fl.seoSubtitle} score={data.seoScore} />
      <div className={CARD_BODY}>
        <TagCloud   label={fl.keywords}           items={data.keywords}      dotClass={agent.dotClass} />
        <BulletList label={fl.technicalGaps}      items={data.technicalGaps} dotClass={agent.dotClass} />
        <InsightBlock label={fl.optimizationPlan} value={data.optimizationPlan} dotClass={agent.dotClass} />
      </div>
    </div>
  );
}

function MarketingCard({
  agent, data, fl,
}: {
  agent: AgentConfig & { id: "marketing" };
  data:  BoardData["marketing"];
  fl:    FieldLabels;
}) {
  return (
    <div className={cn(CARD_SHELL, GLASS)}>
      <AgentHeader agent={agent} subtitle={fl.mktSubtitle} score={data.marketingScore} />
      <div className={CARD_BODY}>
        <InsightBlock label={fl.targetAudience}   value={data.targetAudience}   dotClass={agent.dotClass} />
        <InsightBlock label={fl.toneOfVoice}      value={data.toneOfVoice}      dotClass={agent.dotClass} />
        <InsightBlock label={fl.emotionalAppeal}  value={data.emotionalAppeal}  dotClass={agent.dotClass} />
        <InsightBlock label={fl.ctaEffectiveness} value={data.ctaEffectiveness} dotClass={agent.dotClass} />
      </div>
    </div>
  );
}

function UxCard({
  agent, data, fl,
}: {
  agent: AgentConfig & { id: "ux" };
  data:  BoardData["ux"];
  fl:    FieldLabels;
}) {
  return (
    <div className={cn(CARD_SHELL, GLASS)}>
      <AgentHeader agent={agent} subtitle={fl.uxSubtitle} score={data.uxScore} />
      <div className={CARD_BODY}>
        <InsightBlock label={fl.navigationClarity}   value={data.navigationClarity}   dotClass={agent.dotClass} />
        <InsightBlock label={fl.userJourneyFriction} value={data.userJourneyFriction} dotClass={agent.dotClass} />
        <BulletList   label={fl.accessibilityIssues} items={data.accessibilityIssues} dotClass={agent.dotClass} />
        {data.designStyle && (
          <InsightBlock label={fl.designStyle} value={data.designStyle} dotClass={agent.dotClass} />
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function BoardSkeleton({ lang: propLang }: { lang?: Lang }) {
  const { lang: ctxLang } = useLang();
  const lang  = (propLang ?? ctxLang) as Lang;
  const title = BOARD_TITLE[lang in BOARD_TITLE ? lang : "en"];

  const [msgIdx, setMsgIdx] = useState([0, 0, 0]);
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((prev) => prev.map((v, i) => (v + 1) % AGENTS[i].cyclingMsgs.length));
    }, 1_800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-8 w-full max-w-6xl mx-auto space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {AGENTS.map((agent, i) => (
          <div key={agent.id} className={cn("rounded-[2rem] overflow-hidden", GLASS)}>
            <div className={cn(
              "flex items-center gap-3 p-5 bg-gradient-to-br border-b border-white/15",
              agent.accentFrom, agent.accentTo,
            )}>
              <span className="text-2xl">{agent.emoji}</span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-bold text-foreground">{agent.title}</p>
                <p className="animate-pulse text-xs text-muted-foreground">
                  {agent.cyclingMsgs[msgIdx[i]]}
                </p>
              </div>
              <Skeleton className="h-[76px] w-[76px] rounded-full opacity-40" />
            </div>
            <div className="space-y-3 p-5">
              <Skeleton className="h-2.5 w-full rounded-full opacity-30" />
              <Skeleton className="h-2.5 w-4/5 rounded-full opacity-30" />
              <Skeleton className="h-2.5 w-3/4 rounded-full opacity-30" />
              <Skeleton className="h-2.5 w-full rounded-full opacity-30" />
              <Skeleton className="h-2.5 w-2/3 rounded-full opacity-30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface BoardOfDirectorsProps { data: BoardData; lang?: Lang }

export function BoardOfDirectors({ data, lang: propLang }: BoardOfDirectorsProps) {
  const { lang: ctxLang } = useLang();
  const lang  = (propLang ?? ctxLang) as Lang;
  const title = BOARD_TITLE[lang in BOARD_TITLE ? lang : "en"];
  const fl    = FIELD_LABELS[lang in FIELD_LABELS ? lang : "en"];

  const seoAgent = AGENTS.find((a) => a.id === "seo")!;
  const mktAgent = AGENTS.find((a) => a.id === "marketing")!;
  const uxAgent  = AGENTS.find((a) => a.id === "ux")!;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SeoCard
          agent={seoAgent as AgentConfig & { id: "seo" }}
          data={data.seo}
          fl={fl}
        />
        <MarketingCard
          agent={mktAgent as AgentConfig & { id: "marketing" }}
          data={data.marketing}
          fl={fl}
        />
        <UxCard
          agent={uxAgent as AgentConfig & { id: "ux" }}
          data={data.ux}
          fl={fl}
        />
      </div>
    </div>
  );
}
