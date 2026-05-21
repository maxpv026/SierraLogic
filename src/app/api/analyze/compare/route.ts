export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { openai }          from "@/lib/ai";
import { scrapeWebsite }   from "@/services/scraper";
import type { ApiResponse, CompareResult, RadarDataPoint } from "@/types";

const MAX_CHARS_PER_SITE = 6_000;

const SYSTEM_PROMPT = `You are a competitive intelligence analyst. Compare two websites based on their scraped content and return ONLY a valid JSON object — no markdown, no explanation.

Score each dimension 0–100 based strictly on evidence in the text. Differentiate scores meaningfully (do not cluster everything near 50).

Required JSON schema:
{
  "radarData": [
    { "subject": "SEO Keywords",     "site1": <integer 0-100>, "site2": <integer 0-100> },
    { "subject": "Readability",      "site1": <integer 0-100>, "site2": <integer 0-100> },
    { "subject": "Content Depth",    "site1": <integer 0-100>, "site2": <integer 0-100> },
    { "subject": "Call to Action",   "site1": <integer 0-100>, "site2": <integer 0-100> },
    { "subject": "Trust & Authority","site1": <integer 0-100>, "site2": <integer 0-100> }
  ],
  "verdict": "<2-3 punchy sentences naming a clear winner and why>",
  "site1Strengths": ["<string>", "<string>", "<string>"],
  "site2Strengths": ["<string>", "<string>", "<string>"],
  "actionableAdvice": ["<string>", "<string>", "<string>"]
}`;

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

function clamp(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return isNaN(v) ? 50 : Math.max(0, Math.min(100, Math.round(v)));
}

function parseStrArray(raw: unknown, count: number): string[] {
  if (!Array.isArray(raw)) return Array(count).fill("N/A");
  return raw
    .slice(0, count)
    .map((s) => (typeof s === "string" ? s.trim().slice(0, 300) : "N/A"))
    .concat(Array(Math.max(0, count - raw.length)).fill("N/A"));
}

const SUBJECTS = ["SEO Keywords", "Readability", "Content Depth", "Call to Action", "Trust & Authority"];

function parseCompareResult(raw: string): CompareResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned malformed JSON");
  }

  const p = parsed as Record<string, unknown>;

  const radarData: RadarDataPoint[] = SUBJECTS.map((subject, i) => {
    const row = Array.isArray(p.radarData) ? (p.radarData[i] as Record<string, unknown> | undefined) : undefined;
    return {
      subject,
      site1: clamp(row?.site1 ?? 50),
      site2: clamp(row?.site2 ?? 50),
    };
  });

  const verdict = typeof p.verdict === "string" ? p.verdict.trim().slice(0, 500) : "No verdict available.";

  return {
    radarData,
    verdict,
    site1Strengths:   parseStrArray(p.site1Strengths,   3),
    site2Strengths:   parseStrArray(p.site2Strengths,   3),
    actionableAdvice: parseStrArray(p.actionableAdvice, 3),
    site1Url: "",
    site2Url: "",
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const parsedUrl1 = parseUrl(b?.url1);
  const parsedUrl2 = parseUrl(b?.url2);

  if (!parsedUrl1) {
    return NextResponse.json<ApiResponse>({ success: false, error: "url1 must be a valid http/https URL" }, { status: 400 });
  }
  if (!parsedUrl2) {
    return NextResponse.json<ApiResponse>({ success: false, error: "url2 must be a valid http/https URL" }, { status: 400 });
  }

  const url1 = parsedUrl1.toString();
  const url2 = parsedUrl2.toString();

  // Scrape both sites concurrently
  const [scraped1, scraped2] = await Promise.all([scrapeWebsite(url1), scrapeWebsite(url2)]);

  if (!scraped1.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Site 1 scrape failed: ${scraped1.error}` }, { status: 422 });
  }
  if (!scraped2.success) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Site 2 scrape failed: ${scraped2.error}` }, { status: 422 });
  }

  const text1 = scraped1.text.slice(0, MAX_CHARS_PER_SITE);
  const text2 = scraped2.text.slice(0, MAX_CHARS_PER_SITE);

  const userPrompt =
    `SITE 1 (${url1}):\n---\n${text1}\n---\n\n` +
    `SITE 2 (${url2}):\n---\n${text2}\n---`;

  let result: CompareResult;
  try {
    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature:     0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    result = parseCompareResult(raw);
    result.site1Url = url1;
    result.site2Url = url2;
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI comparison failed";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 502 });
  }

  return NextResponse.json<ApiResponse<CompareResult>>({ success: true, data: result });
}
