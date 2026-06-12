import { chatJSON, type AiProvider } from "@/lib/ai";
import type {
  Sentiment, BoardData,
  SeoAgentResult, MarketingAgentResult, UxAgentResult,
  TaskInput, TaskCategory, TaskPriority,
} from "@/types";

const MAX_INPUT_CHARS = 10_000;

// ─── System prompts ───────────────────────────────────────────────────────────

const SEO_SYSTEM = `You are a ruthless Technical SEO Lead with 15 years of experience.
Identify opportunities and critical failures in website SEO.
Return ONLY a valid JSON object — no markdown, no explanation.

{
  "keywords":         [<up to 8 primary SEO keywords — found or conspicuously missing>],
  "topics":           [<2–5 main content topics, concise noun phrases>],
  "technicalGaps":    [<up to 5 specific SEO issues: thin content, missing CTAs, no schema, etc.>],
  "seoScore":         <integer 0–100>,
  "optimizationPlan": "<2–3 concrete sentences on the highest-impact improvements>"
}`;

const MARKETING_SYSTEM = `You are a creative, conversion-focused Chief Marketing Officer.
Evaluate how effectively the content attracts, engages, and converts visitors.
Return ONLY a valid JSON object — no markdown, no explanation.

{
  "targetAudience":   "<specific audience description>",
  "toneOfVoice":      "<brand voice: e.g. Authoritative, Conversational, Playful>",
  "emotionalAppeal":  "<what emotions the content evokes and whether they drive conversion>",
  "ctaEffectiveness": "<are CTAs present, clear, and compelling? 1–2 sentences>",
  "marketingScore":   <integer 0–100>,
  "sentiment":        "<positive|neutral|negative>",
  "sentimentScore":   <integer 0–100, where 0=very negative 100=very positive>,
  "summary":          "<2-sentence executive summary of the site value proposition>",
  "category":         "<site type, e.g. B2B SaaS, E-commerce, News Platform, Portfolio>"
}`;

const TASK_SYSTEM = `You are a strategic web consultant turning website weaknesses into an actionable improvement roadmap.
Return ONLY a valid JSON object — no markdown, no explanation.

{
  "tasks": [
    {
      "title":       "<action-verb phrase, max 8 words>",
      "description": "<1-2 sentences: exactly what to do and why it matters>",
      "category":    "<SEO|MARKETING|UX>",
      "priority":    "<HIGH|MEDIUM|LOW>"
    }
  ]
}

Generate exactly 6 tasks. Distribute across categories (2 SEO, 2 MARKETING, 2 UX). Order by impact descending.
Assign HIGH priority only to tasks that directly hurt revenue or rankings.`;

const UX_SYSTEM = `You are an empathetic, detail-oriented Lead UX Researcher.
Find friction in the user journey and surface accessibility concerns.
Return ONLY a valid JSON object — no markdown, no explanation.

{
  "navigationClarity":   "<assessment of navigation clarity from the scraped content>",
  "accessibilityIssues": [<up to 4 potential accessibility concerns inferred from content structure>],
  "userJourneyFriction": "<key friction points for a first-time visitor>",
  "uxScore":             <integer 0–100>,
  "designStyle":         "<2–4 comma-separated design style descriptors>"
}`;

// ─── Parsers ──────────────────────────────────────────────────────────────────

function clampInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? fallback : Math.max(0, Math.min(100, Math.round(n)));
}

function strArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max)
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 600) : fallback;
}

function parseSeo(raw: string): SeoAgentResult {
  const p = JSON.parse(raw) as Record<string, unknown>;
  return {
    keywords:         strArr(p.keywords, 8),
    topics:           strArr(p.topics, 5),
    technicalGaps:    strArr(p.technicalGaps, 5),
    seoScore:         clampInt(p.seoScore, 50),
    optimizationPlan: str(p.optimizationPlan, "No plan returned."),
  };
}

function parseMarketing(raw: string): MarketingAgentResult {
  const p    = JSON.parse(raw) as Record<string, unknown>;
  const rawS = str(p.sentiment, "neutral").toLowerCase();
  const sentiment = (["positive", "neutral", "negative"].includes(rawS)
    ? rawS : "neutral") as Sentiment;
  return {
    targetAudience:   str(p.targetAudience, "Unknown"),
    toneOfVoice:      str(p.toneOfVoice,    "Neutral"),
    emotionalAppeal:  str(p.emotionalAppeal,  ""),
    ctaEffectiveness: str(p.ctaEffectiveness, ""),
    marketingScore:   clampInt(p.marketingScore, 50),
    sentiment,
    sentimentScore:   clampInt(p.sentimentScore, 50),
    summary:          str(p.summary,  "No summary available."),
    category:         str(p.category, "General"),
  };
}

function parseUx(raw: string): UxAgentResult {
  const p = JSON.parse(raw) as Record<string, unknown>;
  return {
    navigationClarity:   str(p.navigationClarity,   ""),
    accessibilityIssues: strArr(p.accessibilityIssues, 4),
    userJourneyFriction: str(p.userJourneyFriction, ""),
    uxScore:             clampInt(p.uxScore, 50),
    designStyle:         str(p.designStyle, ""),
  };
}

const VALID_CATEGORIES = new Set<string>(["SEO", "MARKETING", "UX"]);
const VALID_PRIORITIES  = new Set<string>(["HIGH", "MEDIUM", "LOW"]);

function parseTasks(raw: string): TaskInput[] {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(p.tasks)) return [];
    return p.tasks.slice(0, 7).flatMap((t): TaskInput[] => {
      const task = t as Record<string, unknown>;
      const cat  = str(task.category, "").toUpperCase();
      const pri  = str(task.priority,  "").toUpperCase();
      return [{
        title:       str(task.title,       "Improvement task").slice(0, 120),
        description: str(task.description, "").slice(0, 400),
        category:    (VALID_CATEGORIES.has(cat) ? cat : "SEO") as TaskCategory,
        priority:    (VALID_PRIORITIES.has(pri)  ? pri : "MEDIUM") as TaskPriority,
      }];
    });
  } catch {
    return [];
  }
}

// ─── Exported analysis result type ───────────────────────────────────────────

export interface MultiAgentAnalysis {
  topics:           string[];
  sentiment:        Sentiment;
  sentimentScore:   number;
  summary:          string;
  keywords:         string[];
  category:         string;
  designStyle:      string;
  boardOfDirectors: BoardData;
  tasks:            TaskInput[];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeContent(
  text:     string,
  language = "English",
  provider: AiProvider = "openai",
): Promise<MultiAgentAnalysis> {
  const input       = text.slice(0, MAX_INPUT_CHARS);
  const langNote    = `\nIMPORTANT: Write ALL text fields in ${language}. Do not mix languages.`;
  const userContent = `${langNote}\n\nCONTENT:\n${input}`;

  const call = (system: string) => chatJSON({ system, user: userContent, temperature: 0.2, provider });

  // Fan-out: all 4 agents run concurrently
  const [seoRaw, mktRaw, uxRaw, taskRaw] = await Promise.all([
    call(SEO_SYSTEM),
    call(MARKETING_SYSTEM),
    call(UX_SYSTEM),
    call(TASK_SYSTEM),
  ]);

  const seo   = parseSeo(seoRaw);
  const mkt   = parseMarketing(mktRaw);
  const ux    = parseUx(uxRaw);
  const tasks = parseTasks(taskRaw);

  return {
    topics:         seo.topics.length ? seo.topics : ["General"],
    sentiment:      mkt.sentiment,
    sentimentScore: mkt.sentimentScore,
    summary:        mkt.summary,
    keywords:       seo.keywords,
    category:       mkt.category,
    designStyle:    ux.designStyle,
    boardOfDirectors: { seo, marketing: mkt, ux },
    tasks,
  };
}
