export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import type { ApiResponse } from "@/types";

const VALID_RATINGS = new Set(["good", "bad"]);

/**
 * Records human feedback on an AI-generated cold email draft.
 * "good" ratings (optionally with an edited version) build the corpus used
 * to fine-tune a dedicated cold-email generation model in the future.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id, userId } });
  if (!lead) return NextResponse.json<ApiResponse>({ success: false, error: "Lead not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const rating = b?.rating;
  if (typeof rating !== "string" || !VALID_RATINGS.has(rating)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "rating must be 'good' or 'bad'" }, { status: 400 });
  }

  const editedDraft = typeof b?.editedDraft === "string" && b.editedDraft.trim()
    ? b.editedDraft.trim()
    : null;

  await prisma.emailFeedback.create({
    data: {
      leadId:      lead.id,
      url:         lead.url,
      emailDraft:  lead.coldEmailDraft,
      editedDraft,
      rating,
      userId,
    },
  });

  return NextResponse.json<ApiResponse>({ success: true });
}
