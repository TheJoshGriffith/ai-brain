import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { documentService } from "@/lib/services";
import { DocumentEditor } from "./document-editor";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const doc = session?.user ? await documentService().get(session.user.id, id) : undefined;
  if (!doc) notFound();

  return (
    <DocumentEditor id={doc.id} initialTitle={doc.title} initialContent={doc.content} />
  );
}
