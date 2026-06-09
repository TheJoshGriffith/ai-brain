import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { documentService } from "@/lib/services";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { DocumentEditor } from "./document-editor";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user) notFound();
  const doc = await documentService().get(session.user.id, id);
  if (!doc) notFound();
  const backlinks = await documentService().backlinks(session.user.id, id);

  return (
    <div className="space-y-4">
      <DocumentEditor id={doc.id} initialTitle={doc.title} initialContent={doc.content} />
      <BacklinksPanel backlinks={backlinks} />
    </div>
  );
}
