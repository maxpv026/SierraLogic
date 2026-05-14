export type Sentiment = "positive" | "neutral" | "negative";

export interface AIAnalysis {
  topics:         string[];
  sentiment:      Sentiment;
  sentimentScore: number;    // 0 (very negative) → 100 (very positive)
  summary:        string;
  keywords:       string[];
  category:       string;    // e.g. "E-commerce", "B2B SaaS", "News Platform"
  designStyle:    string;    // e.g. "Minimalist, Dark Mode, Typography-focused"
}

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
  sentimentScore?: number;
  category?:       string;
  designStyle?:    string;
  scrapedText?:    string;  // raw page text, used as chat context
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
