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
      "You are a helpful analyst assistant. " +
      "Answer questions based ONLY on the following website content.\n\n" +
      "WEBSITE CONTENT:\n---\n" + context + "\n---\n\n" +
      "Rules:\n" +
      "- If the answer is not in the content, say so clearly.\n" +
      "- Be concise and direct. Quote the relevant section when helpful.\n" +
      "- Do not invent information that isn't in the content.",
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
