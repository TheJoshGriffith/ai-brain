import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DocumentForbiddenError, DocumentNotFoundError } from "@ai-brain/core";
import { documentService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Document not found" }, { status: 404 });
const forbiddenAccess = () =>
  NextResponse.json({ error: "You do not have permission to modify this document" }, { status: 403 });

// GET /api/documents/:id
export async function GET(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");

  const { id } = await params;
  const doc = await documentService().get(principal.userId, id);
  return doc ? NextResponse.json({ document: doc }) : notFound();
}

// PATCH /api/documents/:id
export async function PATCH(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");

  const { id } = await params;
  try {
    const body = await req.json();
    const doc = await documentService().update(principal.userId, id, body);
    return NextResponse.json({ document: doc });
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return forbiddenAccess();
    if (error instanceof DocumentNotFoundError) return notFound();
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    throw error;
  }
}

// DELETE /api/documents/:id
export async function DELETE(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");

  const { id } = await params;
  try {
    const ok = await documentService().remove(principal.userId, id);
    return ok ? NextResponse.json({ deleted: true }) : notFound();
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return forbiddenAccess();
    throw error;
  }
}
