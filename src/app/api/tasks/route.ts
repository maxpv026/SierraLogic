export const runtime = "nodejs";

import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import type { ApiResponse, TaskItem } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json<ApiResponse<TaskItem[]>>({ success: true, data: tasks as TaskItem[] });
}
