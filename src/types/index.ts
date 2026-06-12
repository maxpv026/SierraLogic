export type Sentiment = "positive" | "neutral" | "negative";

// ─── Board of Directors agent result types ────────────────────────────────────

export interface SeoAgentResult {
  keywords:         string[];
  topics:           string[];
  technicalGaps:    string[];
  seoScore:         number;
  optimizationPlan: string;
}

export interface MarketingAgentResult {
  targetAudience:   string;
  toneOfVoice:      string;
  emotionalAppeal:  string;
  ctaEffectiveness: string;
  marketingScore:   number;
  sentiment:        Sentiment;
  sentimentScore:   number;
  summary:          string;
  category:         string;
}

export interface UxAgentResult {
  navigationClarity:   string;
  accessibilityIssues: string[];
  userJourneyFriction: string;
  uxScore:             number;
  designStyle:         string;
}

export interface BoardData {
  seo:       SeoAgentResult;
  marketing: MarketingAgentResult;
  ux:        UxAgentResult;
}

// ─── Analysis result (DB record + enriched fields) ────────────────────────────

export interface AnalysisResult {
  id:             string;
  url:            string;
  topics:         string[];
  sentiment:      Sentiment;
  summary:        string | null;
  keywords:       string[];
  userId:         string | null;
  createdAt:      Date;
  // Enriched fields returned from the AI layer — not persisted to DB
  sentimentScore?:   number;
  category?:         string;
  designStyle?:      string;
  scrapedText?:      string;  // raw page text, used as chat context
  boardOfDirectors?: BoardData;
  cached?:           boolean; // true if served from the 24h analysis cache
  aiProvider?:       string;  // "openai" | "anthropic" — which model produced this analysis
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnalyzeRequest {
  url: string;
  language?: string;
}

export interface ScrapedContent {
  url: string;
  title: string;
  text: string;
}

export type ScrapeResult =
  | { success: true; url: string; title: string; text: string }
  | { success: false; error: string };

// ─── Kanban task types ────────────────────────────────────────────────────────

export type TaskStatus   = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskCategory = "SEO"  | "MARKETING"   | "UX";
export type TaskPriority = "HIGH" | "MEDIUM"       | "LOW";

export interface TaskItem {
  id:             string;
  title:          string;
  description:    string;
  status:         TaskStatus;
  category:       TaskCategory;
  priority:       TaskPriority;
  userId:         string;
  solution?:      string | null;
  createdAt:      Date | string;
}

export interface TaskInput {
  title:       string;
  description: string;
  category:    TaskCategory;
  priority:    TaskPriority;
}

export interface RadarDataPoint {
  subject: string;
  site1:   number;
  site2:   number;
}

export interface CompareResult {
  radarData:        RadarDataPoint[];
  verdict:          string;
  site1Strengths:   string[];
  site2Strengths:   string[];
  actionableAdvice: string[];
  site1Url:         string;
  site2Url:         string;
}

// ─── Agency Lead Machine ──────────────────────────────────────────────────────

export type LeadStatus = "DRAFT" | "CONTACTED" | "CONVERTED";

export interface LeadFlaw {
  title:       string;
  description: string;
}

export interface AgencyLead {
  id:              string;
  url:             string;
  companyName:     string | null;
  identifiedFlaws: LeadFlaw[];
  coldEmailDraft:  string;
  status:          LeadStatus;
  userId:          string;
  createdAt:       Date | string;
}

// ─── AI Vision (VLM design audit) ────────────────────────────────────────────

export interface VisionFix {
  element:  string;
  issue:    string;
  solution: string;
}

export interface VisionResult {
  overallImpression: string;
  uxAnalysis:        string[];
  uiAnalysis:        string[];
  croSuggestions:    string[];
  actionableFixes:   VisionFix[];
  screenshotUrl:     string;
  analyzedUrl:       string;
}
