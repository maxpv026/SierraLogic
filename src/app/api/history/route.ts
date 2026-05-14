import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse, AnalysisResult, Sentiment } from "@/types";

export async function GET() {
  try {
    const records = await prisma.analysisResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // sentiment is stored as plain string; cast back to the union (values are
    // validated by ai-analyzer before write, so this cast is always safe)
    const data: AnalysisResult[] = records.map((r) => ({
      ...r,
      sentiment: r.sentiment as Sentiment,
    }));

    return NextResponse.json<ApiResponse<AnalysisResult[]>>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch history";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
