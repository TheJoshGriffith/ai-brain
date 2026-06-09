import { NextResponse } from "next/server";
import { DocumentForbiddenError, DocumentNotFoundError } from "@ai-brain/core";
import { tagService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");
  const { id } = await params;
  return NextResponse.json({ tags: await tagService().getDocumentTags(id) });
}

// PUT /api/documents/:id/tags — body: { tags: string[] } (replaces the set)
export async function PUT(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");
  const { id } = await params;
  try {
    const { tags } = await req.json();
    const set = await tagService().setDocumentTags(principal.userId, id, Array.isArray(tags) ? tags : []);
    return NextResponse.json({ tags: set });
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof DocumentNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}
