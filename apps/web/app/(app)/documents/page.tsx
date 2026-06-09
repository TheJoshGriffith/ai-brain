import Link from "next/link";
import { canWrite } from "@ai-brain/core";
import { auth } from "@/auth";
import { documentService, tagService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { Button } from "@/components/ui";
import { createDocumentAction } from "./actions";

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
  const mayWrite = canWrite(current.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-gray-400">
            {current.name}
            {current.role !== "owner" ? ` · you are a ${current.role}` : ""}
          </p>
        </div>
        {mayWrite ? (
          <form action={createDocumentAction}>
            <Button type="submit">New document</Button>
          </form>
        ) : null}
      </div>

      {spaceTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/documents"
            className={
              "rounded-full px-2 py-0.5 " +
              (!tag ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800")
            }
          >
            all
          </Link>
          {spaceTags.map((t) => (
            <Link
              key={t.id}
              href={`/documents?tag=${encodeURIComponent(t.name)}`}
              className={
                "rounded-full px-2 py-0.5 " +
                (tag === t.name ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800")
              }
            >
              #{t.name}
            </Link>
          ))}
        </div>
      ) : null}

      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">
          No documents yet. Create one, or have Claude/Codex write to your brain over the API.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.title}</span>
                  <span className="block truncate text-xs text-gray-400">/{d.slug}</span>
                </span>
                <time className="shrink-0 text-xs text-gray-400">
                  {new Date(d.updatedAt).toLocaleString()}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
