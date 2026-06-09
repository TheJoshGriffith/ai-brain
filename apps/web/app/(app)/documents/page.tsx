import { canWrite } from "@ai-brain/core";
import { auth } from "@/auth";
import { documentService, tagService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { KbView, type KbDoc } from "./kb-view";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { current } = await getSpacesAndCurrent(session.user.id);
  const { tag } = await searchParams;

  const [docs, spaceTags] = await Promise.all([
    tag
      ? tagService().listDocumentsByTag(session.user.id, current.id, tag)
      : documentService().list(session.user.id, current.id),
    tagService().listForSpace(session.user.id, current.id),
  ]);
  const tagMap = await tagService().tagsByDocuments(docs.map((d) => d.id));

  const kbDocs: KbDoc[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    updatedAt: d.updatedAt.toISOString(),
    tags: tagMap[d.id] ?? [],
    indexStatus: d.indexStatus,
  }));

  return (
    <KbView
      docs={kbDocs}
      spaceTags={spaceTags.map((t) => ({ id: t.id, name: t.name }))}
      activeTag={tag}
      spaceName={current.name}
      mayWrite={canWrite(current.role)}
    />
  );
}
