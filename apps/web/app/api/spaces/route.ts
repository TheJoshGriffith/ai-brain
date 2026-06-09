import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { spaceService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/spaces — spaces the caller belongs to.
export async function GET(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:read")) return forbidden("spaces:read");
  const spaces = await spaceService().list(principal.userId);
  return NextResponse.json({ spaces });
}

// POST /api/spaces — create a space. Body: { name }
export async function POST(req: Request) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:write")) return forbidden("spaces:write");
  try {
    const body = await req.json();
    const space = await spaceService().create(principal.userId, body);
    return NextResponse.json({ space }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    throw error;
  }
}
