import { NextResponse } from "next/server";
import { ping } from "@ai-brain/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness + DB connectivity (used by the container healthcheck).
export async function GET() {
  const ok = await ping();
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", db: ok },
    { status: ok ? 200 : 503 },
  );
}
