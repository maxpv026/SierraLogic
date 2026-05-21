export const runtime = "nodejs";

import { NextRequest, NextResponse }  from "next/server";
import { openai }                     from "@/lib/ai";
import { captureScreenshot }          from "@/lib/screenshot";
import type { ApiResponse, VisionResult, VisionFix } from "@/types";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite UX/UI Designer and Conversion Rate Optimization (CRO) Expert with 20 years of experience at top product companies.

Analyze the provided website screenshot with brutal honesty and high constructiveness. Evaluate:
- Visual hierarchy and attention flow
- Typography, spacing, and color contrast
- Navigation clarity and cognitive load
- Trust signals and social proof placement
- Call-to-action effectiveness and conversion friction
- Layout consistency and modern aesthetic alignment
- Accessibility considerations visible from the screenshot

Return ONLY a valid JSON object matching this exact schema — no markdown, no explanation:

{
  "overallImpression": "<2-3 sentence executive summary of the site's visual quality and UX maturity>",
  "uxAnalysis": [
    "<UX point 1: visual hierarchy or navigation issue>",
    "<UX point 2: user flow or cognitive load issue>",
    "<UX point 3: layout or spacing concern>",
    "<UX point 4: optional additional insight>"
  ],
  "uiAnalysis": [
    "<UI point 1: typography or readability>",
    "<UI point 2: color contrast or brand consistency>",
    "<UI point 3: spacing, density, or modern aesthetic>",
    "<UI point 4: optional additional insight>"
  ],
  "croSuggestions": [
    "<CRO point 1: primary CTA effectiveness>",
    "<CRO point 2: conversion friction or trust signal>",
    "<CRO point 3: optional urgency or value proposition>"
  ],
  "actionableFixes": [
    { "element": "<specific UI element, e.g. 'Hero CTA button'>", "issue": "<what is broken>", "solution": "<exact fix recommendation>" },
    { "element": "...", "issue": "...", "solution": "..." }
  ]
}

actionableFixes should contain 4-6 items ordered by business impact (highest first). Be specific — name actual elements visible in the screenshot.`;

// ─── Parser ───────────────────────────────────────────────────────────────────

function strArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max)
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 800) : fallback;
}

function parseVisionResult(raw: string, url: string, screenshotUrl: string): VisionResult {
  const p = JSON.parse(raw) as Record<string, unknown>;

  const actionableFixes: VisionFix[] = Array.isArray(p.actionableFixes)
    ? p.actionableFixes.slice(0, 6).map((f): VisionFix => {
        const fix = f as Record<string, unknown>;
        return {
          element:  str(fix.element,  "UI Element"),
          issue:    str(fix.issue,    "Issue identified"),
          solution: str(fix.solution, "Fix recommended"),
        };
      })
    : [];

  return {
    overallImpression: str(p.overallImpression, "Analysis complete."),
    uxAnalysis:        strArr(p.uxAnalysis,      5),
    uiAnalysis:        strArr(p.uiAnalysis,      5),
    croSuggestions:    strArr(p.croSuggestions,  4),
    actionableFixes,
    screenshotUrl,
    analyzedUrl: url,
  };
}

// ─── URL validator ────────────────────────────────────────────────────────────

function parseUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "http:" || u.protocol === "https:") ? u : null;
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const parsed = parseUrl(b?.url);
  if (!parsed) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "A valid http:// or https:// URL is required" },
      { status: 400 },
    );
  }

  const url      = parsed.toString();
  const language = typeof b?.language === "string" && b.language.trim() ? b.language.trim() : "English";

  // Language instruction appended to force all JSON values to the requested language
  const langInstruction = `\n\nIMPORTANT: You MUST write ALL text values in the JSON output — including overallImpression, every item in uxAnalysis, uiAnalysis, croSuggestions, and all element/issue/solution strings in actionableFixes — entirely in ${language}. Do NOT use English if another language is specified.`;
  const systemPromptWithLang = SYSTEM_PROMPT + langInstruction;

  // 1. Capture screenshot
  let screenshotUrl: string;
  try {
    screenshotUrl = await captureScreenshot(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Screenshot capture failed";
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 422 });
  }

  // 2. VLM analysis via gpt-4o vision
  let result: VisionResult;
  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o",
      max_tokens:  2048,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPromptWithLang },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Perform a full UX/UI/CRO audit of this website: ${url}\n\nAnalyze the screenshot carefully and return the structured JSON report.`,
            },
            {
              type: "image_url",
              image_url: {
                url:    screenshotUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    // Strip markdown fences if model wraps in ```json
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    result = parseVisionResult(cleaned, url, screenshotUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI vision analysis failed";
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 502 });
  }

  return NextResponse.json<ApiResponse<VisionResult>>({ success: true, data: result });
}
