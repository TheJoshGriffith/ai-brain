import { NextResponse } from "next/server";
import { DocumentForbiddenError } from "@ai-brain/core";
import { tagService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// GET /api/spaces/:id/tags — tags defined in the space.
export async function GET(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");
  const { id } = await params;
  try {
    return NextResponse.json({ tags: await tagService().listForSpace(principal.userId, id) });
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
