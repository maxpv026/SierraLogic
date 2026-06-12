export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { exportLeadToHubspot }       from "@/lib/hubspot";
import type { ApiResponse, AgencyLead, LeadFlaw } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id, userId } });
  if (!lead) return NextResponse.json<ApiResponse>({ success: false, error: "Lead not found" }, { status: 404 });

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

  try {
    const result = await exportLeadToHubspot(mapped);
    return NextResponse.json<ApiResponse<{ companyId: string; noteId: string }>>({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot export failed";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 502 });
  }
}
