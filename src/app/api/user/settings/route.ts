export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const VALID_LANGS = new Set(["en", "uk", "de", "fr", "pl"]);

  const updates: {
    name?:     string | null;
    image?:    string | null;
    jobTitle?: string | null;
    company?:  string | null;
    language?: string;
  } = {};
  if (typeof body.name === "string")     updates.name     = body.name.trim()     || null;
  if (typeof body.jobTitle === "string") updates.jobTitle = body.jobTitle.trim() || null;
  if (typeof body.company === "string")  updates.company  = body.company.trim()  || null;
  if (typeof body.image === "string" || body.image === null) {
    updates.image = body.image === "" ? null : (body.image as string | null);
  }
  if (typeof body.language === "string" && VALID_LANGS.has(body.language)) {
    updates.language = body.language;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: updates });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
