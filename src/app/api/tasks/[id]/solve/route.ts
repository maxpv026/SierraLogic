export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { streamChatText }            from "@/lib/ai";

const SYSTEM_PROMPT = `You are an expert Web Developer, SEO Specialist, and UX Engineer.
Your job is to provide the EXACT code, HTML, React component, copy, or configuration needed to fix the described issue.
Base your fix on the user's actual website content when provided.

Rules:
- Output ONLY the ready-to-use fix. No preamble, no explanation prose.
- Use code blocks only when the output IS code (wrap in triple backticks with language tag).
- For pure text/copy suggestions, output plain text — no markdown formatting.
- Keep it concise, production-ready, and directly copy-pasteable.
- Where multiple options exist, pick the best one and briefly annotate inline with a comment.`;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the task — verify it belongs to this user
  const task = await prisma.task.findUnique({
    where:  { id, userId },
    select: { id: true, title: true, description: true, category: true, websiteContext: true },
  });
  if (!task) {
    return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
  }

  const context = task.websiteContext?.trim()
    ? `\n\nRELEVANT WEBSITE CONTENT:\n${task.websiteContext.slice(0, 3_500)}`
    : "";

  const userPrompt =
    `Category: ${task.category}\n` +
    `Task: ${task.title}\n` +
    `Problem: ${task.description}` +
    context;

  // Stream the response so the solution is saved once streaming completes.
  // Falls back to Anthropic Claude internally if OpenAI is unavailable.
  let stream: AsyncIterable<string>;
  try {
    stream = await streamChatText({
      system:     SYSTEM_PROMPT,
      user:       userPrompt,
      maxTokens:  1024,
      temperature: 0.25,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }

  // Pipe the stream to the client and save to DB when done
  const encoder = new TextEncoder();
  let fullText  = "";

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of stream) {
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
        // Persist the completed solution (best-effort — client already has it)
        prisma.task.update({ where: { id, userId }, data: { solution: fullText } })
              .catch(() => {});
      } catch {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
