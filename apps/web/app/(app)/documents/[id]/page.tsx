import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { accessService, documentService, tagService } from "@/lib/services";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { DocumentEditor } from "./document-editor";
import { TagEditor } from "./tag-editor";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user) notFound();
  const access = await accessService().resolveDocumentAccess(session.user.id, id);
  if (!access?.canRead) notFound();
  const doc = await documentService().getByIdUnscoped(id);
  if (!doc) notFound();
  const [backlinks, docTags] = await Promise.all([
    documentService().backlinks(session.user.id, id),
    tagService().getDocumentTags(id),
  ]);

  return (
    <div className="space-y-4">
      <DocumentEditor id={doc.id} initialTitle={doc.title} initialContent={doc.content} readOnly={!access.canWrite} />
      <TagEditor documentId={doc.id} initialTags={docTags} canWrite={access.canWrite} />
      <BacklinksPanel backlinks={backlinks} />
    </div>
  );
}
