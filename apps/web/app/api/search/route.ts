import { NextResponse } from "next/server";
import { searchService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/search?q=…&limit=… — hybrid full-text + semantic search.
export async function GET(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "search:read")) return forbidden("search:read");

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const spaceId = url.searchParams.get("spaceId");
  if (!spaceId) return NextResponse.json({ error: "spaceId is required" }, { status: 400 });
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const results = await searchService().search(principal.userId, spaceId, q, { limit });
  return NextResponse.json({ query: q, spaceId, results });
}
