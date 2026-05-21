export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }           from "next-auth";
import { authOptions }                from "@/lib/auth";
import { prisma }                     from "@/lib/prisma";
import type { ApiResponse, TaskItem, TaskStatus } from "@/types";

const VALID_STATUSES = new Set<string>(["TODO", "IN_PROGRESS", "DONE"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const status = (body as Record<string, unknown>)?.status;
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const task = await prisma.task.update({
      where: { id, userId },  // userId ensures the task belongs to this user
      data:  { status },
    });
    return NextResponse.json<ApiResponse<TaskItem>>({ success: true, data: task as TaskItem });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Task not found or update failed" },
      { status: 404 },
    );
  }
}
