import { NextResponse } from "next/server";
import { DocumentForbiddenError } from "@ai-brain/core";
import { portabilityService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/spaces/:id/export — a zip of the space's Markdown documents.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");

  const { id } = await params;
  try {
    const { bytes } = await portabilityService().exportSpace(principal.userId, id);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="ai-brain-export.zip"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
