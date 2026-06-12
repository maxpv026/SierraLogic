import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fallback model used when the OpenAI request fails (rate limit, outage, etc.)
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function extractText(message: Anthropic.Messages.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }
  return block.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

// ─── JSON chat completion (text-only) ──────────────────────────────────────────
// Tries OpenAI first; on failure falls back to Anthropic Claude so a single
// provider outage doesn't take down analysis.

export type AiProvider = "openai" | "anthropic";

interface ChatJSONParams {
  system: string;
  user: string;
  temperature?: number;
  model?: string;
  provider?: AiProvider;
}

async function callOpenaiJSON({ system, user, temperature, model }: { system: string; user: string; temperature: number; model: string }): Promise<string> {
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}

async function callAnthropicJSON({ system, user, temperature }: { system: string; user: string; temperature: number }): Promise<string> {
  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    temperature,
    system: `${system}\n\nRespond with ONLY the raw JSON object — no markdown code fences, no commentary.`,
    messages: [{ role: "user", content: user }],
  });
  return extractText(message);
}

export async function chatJSON({ system, user, temperature = 0.2, model = "gpt-4o-mini", provider = "openai" }: ChatJSONParams): Promise<string> {
  if (provider === "anthropic") {
    try {
      return await callAnthropicJSON({ system, user, temperature });
    } catch (err) {
      console.error("[ai] Anthropic request failed, falling back to OpenAI:", err);
      return await callOpenaiJSON({ system, user, temperature, model });
    }
  }

  try {
    return await callOpenaiJSON({ system, user, temperature, model });
  } catch (err) {
    console.error("[ai] OpenAI request failed, falling back to Anthropic:", err);
    return await callAnthropicJSON({ system, user, temperature });
  }
}

// ─── JSON chat completion with an image (vision) ───────────────────────────────

interface ChatVisionJSONParams {
  system: string;
  user: string;
  imageUrl: string;
  temperature?: number;
  maxTokens?: number;
}

export async function chatVisionJSON({ system, user, imageUrl, temperature = 0.3, maxTokens = 2048 }: ChatVisionJSONParams): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty content");
    return content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  } catch (err) {
    console.error("[ai] OpenAI vision request failed, falling back to Anthropic:", err);
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: `${system}\n\nRespond with ONLY the raw JSON object — no markdown code fences, no commentary.`,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: user },
          { type: "image", source: { type: "url", url: imageUrl } },
        ],
      }],
    });
    return extractText(message);
  }
}

// ─── Streaming text completion ──────────────────────────────────────────────────

interface StreamChatTextParams {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export async function streamChatText({ system, user, maxTokens = 1024, temperature = 0.25 }: StreamChatTextParams): Promise<AsyncIterable<string>> {
  try {
    const stream = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      stream:      true,
      max_tokens:  maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user },
      ],
    });
    return (async function* () {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    })();
  } catch (err) {
    console.error("[ai] OpenAI stream failed, falling back to Anthropic:", err);
    const stream = anthropic.messages.stream({
      model:       ANTHROPIC_MODEL,
      max_tokens:  maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
    });
    return (async function* () {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    })();
  }
}
