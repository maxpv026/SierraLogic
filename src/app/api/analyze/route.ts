// Force Node.js runtime — the Edge Runtime's Web Fetch API restricts header
// values to ByteStrings (ASCII only), which breaks when Cyrillic content from
// scraped pages or language prompts flows through the OpenAI SDK's HTTP layer.
// Node.js HTTP handles UTF-8 in request bodies without this restriction.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scrapeWebsite } from "@/services/scraper";
import { analyzeContent } from "@/services/ai-analyzer";
import { prisma } from "@/lib/prisma";
import type { ApiResponse, AnalysisResult } from "@/types";

function parseUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  // --- Parse & validate request body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const b = body as Record<string, unknown>;
  const rawUrl = b?.url;
  const parsedUrl = parseUrl(rawUrl);

  const rawLang = b?.language;
  const language = typeof rawLang === "string" && rawLang.trim() ? rawLang.trim() : undefined;

  if (!parsedUrl) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "A valid http:// or https:// URL is required" },
      { status: 400 },
    );
  }

  const url = parsedUrl.toString();

  // --- Scrape ---
  const scraped = await scrapeWebsite(url);
  if (!scraped.success) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: scraped.error },
      { status: 422 },
    );
  }

  // --- AI analysis ---
  let analysis;
  try {
    analysis = await analyzeContent(scraped.text, language);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 502 },
    );
  }

  // --- Persist ---
  let record;
  try {
    record = await prisma.analysisResult.create({
      data: {
        url,
        topics: analysis.topics,
        sentiment: analysis.sentiment,
        summary: analysis.summary,
        keywords: analysis.keywords,
        ...(userId ? { userId } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database write failed";
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }

  // Merge the Prisma record with AI-enriched fields not stored in the DB.
  // sentiment is cast from string to the Sentiment union (safe — validated by parseAndValidate).
  const response: AnalysisResult = {
    ...record,
    sentiment:      analysis.sentiment,
    sentimentScore: analysis.sentimentScore,
    category:       analysis.category,
    designStyle:    analysis.designStyle,
    // Pass the scraped text back so the client can use it as chat context.
    // It is not stored in the DB — kept only in the client session.
    scrapedText:    scraped.text,
  };

  return NextResponse.json<ApiResponse<AnalysisResult>>(
    { success: true, data: response },
    { status: 200 },
  );
}
