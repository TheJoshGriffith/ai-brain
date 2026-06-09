import { NextResponse } from "next/server";
import { SpaceError, type SpaceRole } from "@ai-brain/core";
import { spaceService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; userId: string }> };

// PATCH — body: { role }
export async function PATCH(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:write")) return forbidden("spaces:write");
  const { id, userId } = await params;
  try {
    const { role } = (await req.json()) as { role: SpaceRole };
    await spaceService().updateMemberRole(principal.userId, id, userId, role);
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof SpaceError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:write")) return forbidden("spaces:write");
  const { id, userId } = await params;
  try {
    await spaceService().removeMember(principal.userId, id, userId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof SpaceError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}
