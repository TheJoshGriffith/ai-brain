import Link from "next/link";
import { auth } from "@/auth";
import { searchService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { Input } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Renders a ts_headline snippet, marking the <<matched>> fragments. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/<<(.+?)>>/g);
  return (
    <p className="pi-snip" style={{ margin: "4px 0 0", fontSize: 13 }}>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
    </p>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { q = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = 10;
  const { current } = await getSpacesAndCurrent(session.user.id);
  const results = q.trim()
    ? await searchService().search(session.user.id, current.id, q, { limit, offset: (page - 1) * limit })
    : [];
  const pageHref = (p: number) => `/search?q=${encodeURIComponent(q)}&page=${p}`;

  return (
    <div className="wrap fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="page-sub">Hybrid full-text + semantic search across {current.name}. Tip: press ⌘K anywhere.</p>
        </div>
      </div>
      <form action="/search" style={{ maxWidth: 560 }}>
        <Input name="q" defaultValue={q} placeholder="Search — keywords or meaning…" autoFocus aria-label="Search query" />
      </form>

      {q.trim() ? (
        results.length === 0 ? (
          <p className="hint">{page > 1 ? "No more results." : `No results for “${q}”.`}</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {results.map((r) => (
                <div key={r.documentId}>
                  <Link href={`/documents/${r.documentId}`} className="link-accent" style={{ fontWeight: 500 }}>
                    {r.title}
                  </Link>
                  <span className="faint" style={{ marginLeft: 8, fontSize: 11.5, fontFamily: "var(--font-mono)" }}>
                    {r.matched.join(" + ")}
                  </span>
                  {r.snippet ? <Snippet text={r.snippet} /> : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn-sm">Previous</Link> : null}
              {results.length === limit ? <Link href={pageHref(page + 1)} className="btn btn-sm">Next</Link> : null}
            </div>
          </>
        )
      ) : (
        <p className="hint">Search combines full-text and semantic similarity, so paraphrases match too.</p>
      )}
    </div>
  );
}
