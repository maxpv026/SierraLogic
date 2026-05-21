export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import type { ApiResponse, AgencyLead, LeadFlaw } from "@/types";

const VALID_STATUSES = new Set(["DRAFT", "CONTACTED", "CONVERTED"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const status = (body as Record<string, unknown>)?.status;
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "status must be DRAFT | CONTACTED | CONVERTED" },
      { status: 400 },
    );
  }

  try {
    const lead = await prisma.lead.update({
      where: { id, userId },
      data:  { status },
    });
    const mapped: AgencyLead = {
      id:              lead.id,
      url:             lead.url,
      companyName:     lead.companyName,
      identifiedFlaws: lead.identifiedFlaws as unknown as LeadFlaw[],
      coldEmailDraft:  lead.coldEmailDraft,
      status:          lead.status as AgencyLead["status"],
      userId:          lead.userId,
      createdAt:       lead.createdAt,
    };
    return NextResponse.json<ApiResponse<AgencyLead>>({ success: true, data: mapped });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Lead not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.lead.delete({ where: { id, userId } });
    return NextResponse.json<ApiResponse>({ success: true });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Lead not found" }, { status: 404 });
  }
}
