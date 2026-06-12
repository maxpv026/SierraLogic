export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ApiResponse, AnalysisResult, BoardData, Sentiment } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  // Guests have no saved history — return an empty list immediately
  if (!userId) {
    return NextResponse.json<ApiResponse<AnalysisResult[]>>({ success: true, data: [] });
  }

  try {
    const records = await prisma.analysisResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const data: AnalysisResult[] = records.map((r) => ({
      ...r,
      sentiment:        r.sentiment as Sentiment,
      sentimentScore:   r.sentimentScore   ?? undefined,
      category:         r.category         ?? undefined,
      designStyle:      r.designStyle      ?? undefined,
      scrapedText:      r.scrapedText      ?? undefined,
      boardOfDirectors: (r.boardOfDirectors as unknown as BoardData) ?? undefined,
    }));

    return NextResponse.json<ApiResponse<AnalysisResult[]>>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch history";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
