import { openai } from "@/lib/ai";
import type { AIAnalysis, Sentiment } from "@/types";

const MAX_INPUT_CHARS = 20_000;

const VALID_SENTIMENTS = new Set<string>(["positive", "neutral", "negative"]);

const SYSTEM_PROMPT = `You are an expert B2B Content & SEO Analyst. Analyze the provided webpage text and return a strictly structured JSON object.

Return ONLY a valid JSON object with these EXACT fields — no markdown, no explanation:

{
  "topics":         [string, string, string],
  "sentiment":      "positive" | "neutral" | "negative",
  "sentimentScore": number,
  "summary":        string,
  "keywords":       [string, ...string[]],
  "category":       string,
  "designStyle":    string
}

Field rules:
- topics:         3–5 strings, each ≤ 6 words, concrete and specific to the content
- sentiment:      exactly one of "positive", "neutral", "negative"
- sentimentScore: integer 0–100 (0 = very negative, 50 = neutral, 100 = very positive); must be consistent with the sentiment label (positive ≥ 60, neutral 35–65, negative ≤ 40)
- summary:        exactly 2 sentences for a B2B executive audience
- keywords:       exactly 7 strings, lowercase, mix of single words and short phrases, ordered by relevance
- category:       ONE concise label for the site type — choose the best fit from examples like "News Platform", "E-commerce", "B2B SaaS", "Corporate Blog", "Portfolio", "Education", "Healthcare", "Government", "Real Estate", "Finance", "Tech Media", "NGO / Non-profit" — or coin a clear alternative
- designStyle:    2–4 comma-separated adjectives describing the content style, e.g. "Minimalist, Data-heavy", "Visual-first, Long-form", "Dark mode, Typography-focused", "Corporate, Dense text"`;

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function parseAndValidate(raw: string): AIAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned malformed JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  const topics = Array.isArray(obj.topics)
    ? obj.topics.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];

  const sentiment: Sentiment = VALID_SENTIMENTS.has(obj.sentiment as string)
    ? (obj.sentiment as Sentiment)
    : "neutral";

  const rawScore = typeof obj.sentimentScore === "number" ? obj.sentimentScore : 50;
  const sentimentScore = clamp(Math.round(rawScore), 0, 100);

  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";

  const keywords = Array.isArray(obj.keywords)
    ? obj.keywords.filter((k): k is string => typeof k === "string").slice(0, 7)
    : [];

  const category = typeof obj.category === "string" && obj.category.trim()
    ? obj.category.trim()
    : "General";

  const designStyle = typeof obj.designStyle === "string"
    ? obj.designStyle.trim()
    : "";

  return { topics, sentiment, sentimentScore, summary, keywords, category, designStyle };
}

export async function analyzeContent(text: string, language = "English"): Promise<AIAnalysis> {
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  const systemPrompt =
    SYSTEM_PROMPT +
    `\n\nIMPORTANT: Write ALL output — summary, topics, keywords, category, and designStyle — in ${language}. Do not mix languages.`;

  let raw: string | null;
  try {
    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature:     0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: input },
      ],
    });

    raw = completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("ByteString")) {
      throw new Error(
        "OPENAI_API_KEY contains non-ASCII characters. " +
        "Please set a valid API key (starting with 'sk-') in .env.local.",
      );
    }
    const message = err instanceof Error ? err.message : "Unknown OpenAI error";
    throw new Error(`OpenAI API call failed: ${message}`);
  }

  if (!raw) throw new Error("OpenAI returned an empty response");

  return parseAndValidate(raw);
}
