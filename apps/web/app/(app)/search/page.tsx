import Link from "next/link";
import { auth } from "@/auth";
import { searchService } from "@/lib/services";
import { Input } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Renders a ts_headline snippet, bolding the <<matched>> fragments. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/<<(.+?)>>/g);
  return (
    <p className="mt-1 text-sm text-gray-500">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-brand-100 text-brand-900 dark:bg-brand-500/30 dark:text-brand-100">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const { q = "" } = await searchParams;
  const results = session?.user && q.trim() ? await searchService().search(session.user.id, q) : [];

  return (
    <div className="space-y-6">
      <form action="/search" className="max-w-xl">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search your brain — keywords or meaning…"
          autoFocus
          aria-label="Search query"
        />
      </form>

      {q.trim() ? (
        results.length === 0 ? (
          <p className="text-sm text-gray-500">No results for “{q}”.</p>
        ) : (
          <ul className="space-y-4">
            {results.map((r) => (
              <li key={r.documentId}>
                <Link href={`/documents/${r.documentId}`} className="font-medium text-brand-600 hover:underline">
                  {r.title}
                </Link>
                <span className="ml-2 text-xs text-gray-400">
                  {r.matched.join(" + ")}
                </span>
                {r.snippet ? <Snippet text={r.snippet} /> : null}
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-sm text-gray-400">
          Search combines full-text and semantic similarity, so paraphrases match too.
        </p>
      )}
    </div>
  );
}
