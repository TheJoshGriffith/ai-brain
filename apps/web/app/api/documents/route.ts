import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DocumentForbiddenError, DocumentNotFoundError } from "@ai-brain/core";
import { documentService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/documents?spaceId=… — list documents in a space.
export async function GET(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId");
  if (!spaceId) return NextResponse.json({ error: "spaceId is required" }, { status: 400 });
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  try {
    const [docs, total] = await Promise.all([
      documentService().list(principal.userId, spaceId, { limit, offset }),
      documentService().count(principal.userId, spaceId),
    ]);
    return NextResponse.json({ documents: docs, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// POST /api/documents — create a document. Body: { spaceId, title?, content?, slug? }
export async function POST(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");

  try {
    const { spaceId, ...input } = await req.json();
    if (!spaceId) return NextResponse.json({ error: "spaceId is required" }, { status: 400 });
    const doc = await documentService().create(principal.userId, spaceId, input);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof DocumentForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DocumentNotFoundError) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    throw error;
  }
}
