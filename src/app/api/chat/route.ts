export const runtime = "edge";

import { streamText, convertToModelMessages } from "ai";
import { createOpenAI }                        from "@ai-sdk/openai";
import type { UIMessage }                      from "ai";

const MAX_CONTEXT_CHARS = 12_000;

export async function POST(req: Request) {
  const { messages, websiteContext } = (await req.json()) as {
    messages:       UIMessage[];
    websiteContext: string;
  };

  if (!websiteContext?.trim()) {
    return new Response(JSON.stringify({ error: "websiteContext is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const context = websiteContext.slice(0, MAX_CONTEXT_CHARS);
  const openai  = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const result = streamText({
    model:           openai("gpt-4o-mini"),
    maxOutputTokens: 512,
    temperature:     0.3,
    system:
      "You are an AI assistant analyzing a website. The scraped content of the website is provided below.\n\n" +
      "SCRAPED CONTENT:\n---\n" + context + "\n---\n\n" +
      "Instructions:\n" +
      "1. First, attempt to answer the user's question using ONLY the scraped content above.\n" +
      "2. If the scraped content is clearly incomplete — for example, it consists mainly of boilerplate " +
      "(cookie notices, copyright lines, footer navigation, press links) or obviously lacks the requested information — " +
      "fall back to your general knowledge about the website based on its domain and URL.\n" +
      "3. If you fall back to general knowledge, briefly note that the site likely blocks automated scraping, " +
      "so your answer is based on publicly known information about the domain rather than the live page content.\n" +
      "4. Be concise and direct. Quote the scraped content when it is helpful and available.",
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
