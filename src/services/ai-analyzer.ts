import { openai } from "@/lib/ai";
import type { AIAnalysis, Sentiment } from "@/types";

const MAX_INPUT_CHARS = 20_000;

const VALID_SENTIMENTS = new Set<string>(["positive", "neutral", "negative"]);

const SYSTEM_PROMPT = `You are an expert B2B Content & SEO Analyst. Your task is to analyze the provided webpage text and return a structured JSON object.

You MUST return ONLY a valid JSON object with these EXACT fields — no extra explanation or markdown:

{
  "topics": [string, string, string],        // 3 to 5 main themes of the content
  "sentiment": "positive" | "neutral" | "negative",  // overall tone of the content
  "summary": string,                          // concise 2-sentence summary of the core message
  "keywords": [string, ...string[]]           // top 7 SEO/contextual keywords, ordered by relevance
}

Rules:
- topics: between 3 and 5 strings, each ≤ 6 words, concrete and specific to the content
- sentiment: must be exactly one of "positive", "neutral", or "negative"
- summary: exactly 2 sentences, written for a B2B executive audience
- keywords: exactly 7 strings, lowercase, mix of single words and short phrases`;

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

  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";

  const keywords = Array.isArray(obj.keywords)
    ? obj.keywords.filter((k): k is string => typeof k === "string").slice(0, 7)
    : [];

  return { topics, sentiment, summary, keywords };
}

export async function analyzeContent(text: string, language = "English"): Promise<AIAnalysis> {
  // TEMPORARY DIAGNOSTIC — remove once key is confirmed working
  const key = process.env.OPENAI_API_KEY ?? "";
  console.log(`[ai-analyzer] key prefix="${key.slice(0, 5)}" length=${key.length}`);

  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  const systemPrompt =
    SYSTEM_PROMPT +
    `\n\nIMPORTANT: Write ALL output — summary, topics, and keywords — in ${language}. Do not mix languages.`;

  let raw: string | null;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
    });

    raw = completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    // "Cannot convert argument to a ByteString" means the OPENAI_API_KEY contains
    // non-ASCII characters (e.g. a Cyrillic placeholder). The key is sent in the
    // Authorization header, which must be ASCII-only.
    if (err instanceof TypeError && err.message.includes("ByteString")) {
      throw new Error(
        "OPENAI_API_KEY contains non-ASCII characters. " +
        "Please set a valid API key (starting with 'sk-') in .env.local.",
      );
    }
    const message = err instanceof Error ? err.message : "Unknown OpenAI error";
    throw new Error(`OpenAI API call failed: ${message}`);
  }

  if (!raw) {
    throw new Error("OpenAI returned an empty response");
  }

  return parseAndValidate(raw);
}
