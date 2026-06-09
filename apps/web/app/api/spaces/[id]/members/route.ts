import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
  try {
    return NextResponse.json({ members: await spaceService().listMembers(principal.userId, id) });
  } catch (error) {
    if (error instanceof SpaceError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

// POST /api/spaces/:id/members — body: { email, role }
export async function POST(req: Request, { params }: Params) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "spaces:write")) return forbidden("spaces:write");
  const { id } = await params;
  try {
    const member = await spaceService().addMember(principal.userId, id, await req.json());
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    if (error instanceof SpaceError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
