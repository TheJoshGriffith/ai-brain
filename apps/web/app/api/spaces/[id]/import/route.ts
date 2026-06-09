import { NextResponse } from "next/server";
import { DocumentForbiddenError, PortabilityService } from "@ai-brain/core";
import { portabilityService } from "@/lib/services";
import { authenticateRequest, forbidden, hasScope, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// POST /api/spaces/:id/import — multipart upload of .md files and/or a .zip.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await authenticateRequest(req);
  if (!principal) return unauthorized();
  if (!hasScope(principal, "documents:write")) return forbidden("documents:write");

  const { id } = await params;
  const form = await req.formData();
  const uploads = form.getAll("files").filter((f): f is File => f instanceof File);

  const entries: { name: string; content: string }[] = [];
  for (const file of uploads) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      entries.push(...PortabilityService.unzipMarkdown(new Uint8Array(await file.arrayBuffer())));
    } else if (file.name.toLowerCase().endsWith(".md")) {
      entries.push({ name: file.name, content: await file.text() });
    }
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "No .md files found in the upload" }, { status: 400 });
  }

  try {
    const result = await portabilityService().importFiles(principal.userId, id, entries);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DocumentForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
