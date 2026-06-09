import { NextResponse } from "next/server";
import { DocumentForbiddenError } from "@ai-brain/core";
import { portabilityService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/documents/:id/export — the document as a Markdown file.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:read")) return forbidden("documents:read");

  const { id } = await params;
  try {
    const { filename, text } = await portabilityService().exportDocument(principal.userId, id);
    return new Response(text, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
