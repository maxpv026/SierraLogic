import { NextResponse } from "next/server";

/** Lightweight liveness probe used by Docker health checks and uptime monitors. */
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
