import { NextResponse } from "next/server";
import { DocumentForbiddenError, DocumentNotFoundError } from "@ai-brain/core";
import { documentService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// POST /api/documents/:id/reindex — queue an embedding rebuild.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");

  const { id } = await params;
  try {
    await documentService().requestReindex(principal.userId, id);
    return NextResponse.json({ queued: true });
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof DocumentNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}
