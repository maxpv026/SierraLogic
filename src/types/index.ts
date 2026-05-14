export type Sentiment = "positive" | "neutral" | "negative";

export interface AIAnalysis {
  topics: string[];
  sentiment: Sentiment;
  summary: string;
  keywords: string[];
}

export interface AnalysisResult {
  id: string;
  url: string;
  topics: string[];
  sentiment: Sentiment;
  summary: string | null;
  keywords: string[];
  userId: string | null;
  createdAt: Date;
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
