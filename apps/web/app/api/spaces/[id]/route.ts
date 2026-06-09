import { NextResponse } from "next/server";
import { SpaceError } from "@ai-brain/core";
import { spaceService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:read")) return forbidden("spaces:read");
  const { id } = await params;
  const space = await spaceService().get(principal.userId, id);
  return space ? NextResponse.json({ space }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:write")) return forbidden("spaces:write");
  const { id } = await params;
  try {
    await spaceService().remove(principal.userId, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof SpaceError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}
