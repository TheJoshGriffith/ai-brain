import { NextResponse } from "next/server";
import { documentService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/documents/:id/backlinks — documents that link to this one.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");

  const { id } = await params;
  const doc = await documentService().get(principal.userId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const backlinks = await documentService().backlinks(principal.userId, id);
  return NextResponse.json({ backlinks });
}
