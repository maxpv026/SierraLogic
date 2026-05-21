export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { openai }                    from "@/lib/ai";
import { scrapeWebsite }             from "@/services/scraper";
import type { ApiResponse, AgencyLead, LeadFlaw } from "@/types";
import { LANG_NAMES } from "@/lib/i18n";

const MAX_URLS = 10;

const SYSTEM_PROMPT_BASE = `You are an elite B2B Sales Copywriter and Tech Auditor working for a web agency.
Analyze the provided website content. Return ONLY a valid JSON object — no markdown, no explanation.

{
  "companyName": "<inferred company or brand name, or null if unclear>",
  "identifiedFlaws": [
    { "title": "<short flaw label, e.g. 'Missing Meta Tags'>", "description": "<1 sentence explaining the business impact>" },
    { "title": "<second critical flaw>", "description": "<1 sentence business impact>" }
  ],
  "coldEmailDraft": "<full cold email including subject line. Use this exact format:\nSubject: [compelling subject line]\n\n[Greeting],\n\n[Hook paragraph — mention 1-2 specific flaws found]\n\n[Value proposition — what your agency will achieve]\n\n[Call to action — short, low-friction]\n\nBest,\n[Your Name]\n[Your Agency]>"
}

Rules:
- identifiedFlaws: EXACTLY 2 items, high-impact, specific to this site's content
- coldEmailDraft: under 180 words total, professional but not salesy, highly personalised
- Mention the specific flaws you found as the hook — never generic
- CTA should be soft (e.g. "Would you be open to a 15-minute call?")`;

function buildSystemPrompt(language: string): string {
  const langName = LANG_NAMES[language as keyof typeof LANG_NAMES] ?? language;
  return (
    SYSTEM_PROMPT_BASE +
    `\n\nCRITICAL: You must generate the entire response, including the "identifiedFlaws" descriptions ` +
    `and the "coldEmailDraft", STRICTLY in ${langName}. Do not use any other language.`
  );
}

function parseLeadResponse(raw: string): { companyName: string | null; flaws: LeadFlaw[]; emailDraft: string } {
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const p = JSON.parse(cleaned) as Record<string, unknown>;

  const companyName = typeof p.companyName === "string" ? p.companyName.trim() : null;

  const flaws: LeadFlaw[] = Array.isArray(p.identifiedFlaws)
    ? p.identifiedFlaws.slice(0, 2).map((f): LeadFlaw => {
        const flaw = f as Record<string, unknown>;
        return {
          title:       typeof flaw.title       === "string" ? flaw.title.trim().slice(0, 80)   : "Issue found",
          description: typeof flaw.description === "string" ? flaw.description.trim().slice(0, 200) : "",
        };
      })
    : [{ title: "Issues found", description: "Manual review recommended" }];

  const emailDraft = typeof p.coldEmailDraft === "string"
    ? p.coldEmailDraft.trim()
    : "Cold email generation failed — please retry.";

  return { companyName, flaws, emailDraft };
}

// ─── GET — fetch user's leads ─────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const leads = await prisma.lead.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
  });

  const mapped: AgencyLead[] = leads.map((l) => ({
    id:              l.id,
    url:             l.url,
    companyName:     l.companyName,
    identifiedFlaws: l.identifiedFlaws as unknown as LeadFlaw[],
    coldEmailDraft:  l.coldEmailDraft,
    status:          l.status as AgencyLead["status"],
    userId:          l.userId,
    createdAt:       l.createdAt,
  }));

  return NextResponse.json<ApiResponse<AgencyLead[]>>({ success: true, data: mapped });
}

// ─── POST — bulk generate leads ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  // Plan gate — agency feature is MAX only; also fetch language as fallback
  const dbUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { plan: true, language: true },
  });
  if (dbUser?.plan !== "MAX") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Upgrade to Max to unlock Agency Lead Machine." },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;

  // Language for AI output: client payload → DB user language → "en"
  const rawLang = typeof b?.language === "string" ? b.language.trim() : null;
  const language = rawLang ?? dbUser?.language ?? "en";
  const systemPrompt = buildSystemPrompt(language);

  const rawUrls = b?.urls;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "urls must be a non-empty array" }, { status: 400 });
  }

  // Validate and deduplicate URLs
  const validUrls = [...new Set(
    rawUrls
      .slice(0, MAX_URLS)
      .map((u) => {
        try {
          const parsed = new URL(typeof u === "string" ? u.trim() : "");
          return (parsed.protocol === "http:" || parsed.protocol === "https:") ? parsed.toString() : null;
        } catch { return null; }
      })
      .filter((u): u is string => u !== null),
  )];

  if (validUrls.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No valid URLs provided" }, { status: 400 });
  }

  // Scrape all URLs concurrently — don't let one failure block the rest
  const scrapeResults = await Promise.allSettled(
    validUrls.map(async (url) => {
      const result = await scrapeWebsite(url);
      if (!result.success) throw new Error(result.error);
      return { url, text: result.text.slice(0, 8_000) };
    }),
  );

  // Generate leads for all successfully scraped sites
  const generateResults = await Promise.allSettled(
    scrapeResults.map(async (r, i) => {
      if (r.status !== "fulfilled") throw new Error(`Scrape failed: ${(r.reason as Error).message}`);
      const { url, text } = r.value;

      const completion = await openai.chat.completions.create({
        model:           "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature:     0.35,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: `Website URL: ${url}\n\nScraped content:\n${text}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const { companyName, flaws, emailDraft } = parseLeadResponse(raw);

      return { url, companyName, flaws, emailDraft };
    }),
  );

  // Persist successful leads to DB
  const created: AgencyLead[] = [];
  for (const result of generateResults) {
    if (result.status !== "fulfilled") continue;
    const { url, companyName, flaws, emailDraft } = result.value;
    try {
      const lead = await prisma.lead.create({
        data: {
          url,
          companyName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          identifiedFlaws: flaws as any,
          coldEmailDraft:  emailDraft,
          status:          "DRAFT",
          userId,
        },
      });
      created.push({
        id:              lead.id,
        url:             lead.url,
        companyName:     lead.companyName,
        identifiedFlaws: lead.identifiedFlaws as unknown as LeadFlaw[],
        coldEmailDraft:  lead.coldEmailDraft,
        status:          "DRAFT",
        userId:          lead.userId,
        createdAt:       lead.createdAt,
      });
    } catch { /* skip DB errors for individual leads */ }
  }

  const failCount = generateResults.filter((r) => r.status === "rejected").length;

  return NextResponse.json<ApiResponse<{ leads: AgencyLead[]; failCount: number }>>({
    success: true,
    data: { leads: created, failCount },
  });
}
