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
import type { Prisma } from "@/generated/prisma/client";
import type { ApiResponse, AnalysisResult, BoardData, TaskInput } from "@/types";

// Repeat analyses of the same URL (+ output language) within this window are
// served from the DB instead of re-scraping and re-running the 4 AI agents.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
  const cacheLang = language ?? "en";

  // --- Cache lookup (24h TTL) ---
  const cached = await prisma.analysisResult.findFirst({
    where: {
      url,
      language:  cacheLang,
      createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (cached?.boardOfDirectors && cached.scrapedText) {
    const cachedTasks = (cached.cachedTasks as unknown as TaskInput[] | null) ?? [];

    if (userId && cachedTasks.length > 0) {
      await prisma.task.createMany({
        data: cachedTasks.map((t) => ({
          title:          t.title,
          description:    t.description,
          category:       t.category,
          priority:       t.priority,
          status:         "TODO",
          userId,
          websiteContext: cached.scrapedText!.slice(0, 4_000),
        })),
      }).catch(() => {});
    }

    const response: AnalysisResult = {
      ...cached,
      sentiment:        cached.sentiment as AnalysisResult["sentiment"],
      sentimentScore:   cached.sentimentScore ?? undefined,
      category:         cached.category ?? undefined,
      designStyle:      cached.designStyle ?? undefined,
      scrapedText:      cached.scrapedText,
      boardOfDirectors: cached.boardOfDirectors as unknown as BoardData,
      cached:           true,
    };

    return NextResponse.json<ApiResponse<AnalysisResult>>(
      { success: true, data: response },
      { status: 200 },
    );
  }

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
    [record] = await prisma.$transaction([
      prisma.analysisResult.create({
        data: {
          url,
          topics:    analysis.topics,
          sentiment: analysis.sentiment,
          summary:   analysis.summary,
          keywords:  analysis.keywords,
          ...(userId ? { userId } : {}),
          // Cache fields — let repeat analyses of this URL skip scrape + AI calls for 24h
          language:         cacheLang,
          sentimentScore:   analysis.sentimentScore,
          category:         analysis.category,
          designStyle:      analysis.designStyle,
          scrapedText:      scraped.text,
          boardOfDirectors: analysis.boardOfDirectors as unknown as Prisma.InputJsonValue,
          cachedTasks:      analysis.tasks as unknown as Prisma.InputJsonValue,
        },
      }),
      // Save AI-generated tasks with website context (for the AI fix generator)
      ...(userId && analysis.tasks.length > 0
        ? [prisma.task.createMany({
            data: analysis.tasks.map((t) => ({
              title:          t.title,
              description:    t.description,
              category:       t.category,
              priority:       t.priority,
              status:         "TODO",
              userId,
              // Store up to 4 KB of scraped text so the fix generator has context
              websiteContext: scraped.text.slice(0, 4_000),
            })),
          })]
        : []
      ),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database write failed";
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }

  // Merge the Prisma record with AI-enriched fields not stored in the DB.
  const response: AnalysisResult = {
    ...record,
    sentiment:        analysis.sentiment,
    sentimentScore:   analysis.sentimentScore,
    category:         analysis.category,
    designStyle:      analysis.designStyle,
    scrapedText:      scraped.text,
    boardOfDirectors: analysis.boardOfDirectors,
    cached:           false,
  };

  return NextResponse.json<ApiResponse<AnalysisResult>>(
    { success: true, data: response },
    { status: 200 },
  );
}
