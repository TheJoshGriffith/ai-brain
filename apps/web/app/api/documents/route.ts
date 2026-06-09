import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { documentService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/documents — list the caller's documents.
export async function GET(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const docs = await documentService().list(principal.userId, { limit, offset });
  return NextResponse.json({ documents: docs });
}

// POST /api/documents — create a document.
export async function POST(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");

  try {
    const body = await req.json();
    const doc = await documentService().create(principal.userId, body);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    throw error;
  }
}
