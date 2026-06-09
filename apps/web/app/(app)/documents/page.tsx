import { canWrite } from "@ai-brain/core";
import { auth } from "@/auth";
import { documentService, tagService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { KbView, type KbDoc } from "./kb-view";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string; sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { current } = await getSpacesAndCurrent(session.user.id);
  const { tag, page: pageParam, sort: sortParam } = await searchParams;

  const page = Math.max(1, Number(pageParam) || 1);
  const sort = sortParam === "title" ? "title" : "updated";
  const offset = (page - 1) * PAGE_SIZE;
  const userId = session.user.id;

  const [docs, total, spaceTags] = await Promise.all([
    tag
      ? tagService().listDocumentsByTag(userId, current.id, tag, { limit: PAGE_SIZE, offset, sort })
      : documentService().list(userId, current.id, { limit: PAGE_SIZE, offset, sort }),
    tag
      ? tagService().countDocumentsByTag(userId, current.id, tag)
      : documentService().count(userId, current.id),
    tagService().listForSpace(userId, current.id),
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
      spaceId={current.id}
      mayWrite={canWrite(current.role)}
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      sort={sort}
    />
  );
}
