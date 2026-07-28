"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { File, Layers, Search, Trash2 } from "lucide-react";
import { createDocumentAction } from "./actions";
import { ImportExportControls } from "./import-export";

export interface KbDoc {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  tags: string[];
  indexStatus: "pending" | "indexed" | "failed";
}

const STATUS = {
  indexed: { dot: "dot-green", label: "indexed" },
  pending: { dot: "dot-amber", label: "indexing" },
  failed: { dot: "dot-gray", label: "failed" },
} as const;

export function KbView({
  docs,
  spaceTags,
  activeTag,
  spaceName,
  spaceId,
  mayWrite,
  page,
  pageSize,
  total,
  sort,
}: {
  docs: KbDoc[];
  spaceTags: { id: string; name: string }[];
  activeTag?: string;
  spaceName: string;
  spaceId: string;
  mayWrite: boolean;
  page: number;
  pageSize: number;
  total: number;
  sort: "updated" | "title";
  q: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const rows = docs; // filtering happens server-side (whole space, not just this page)

  // Debounced server-side title search via the URL (?q=…).
  useEffect(() => {
    const term = query.trim();
    if (term === q) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      if (term) sp.set("q", term);
      if (sort !== "updated") sp.set("sort", sort);
      const s = sp.toString();
      router.push(`/documents${s ? `?${s}` : ""}`);
    }, 250);
    return () => clearTimeout(t);
  }, [query, q, sort, router]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);
  const href = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    if (activeTag) sp.set("tag", activeTag);
    if (q) sp.set("q", q);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
    const s = sp.toString();
    return `/documents${s ? `?${s}` : ""}`;
  };

  return (
    <div className="kb-grid">
      <aside className="kb-aside">
        <h4>Library</h4>
        <Link href="/documents" className="tree-item" data-active={!activeTag}>
          <Layers />
          All documents
          <span className="count">{!activeTag ? total : ""}</span>
        </Link>
        <Link href="/trash" className="tree-item">
          <Trash2 />
          Trash
        </Link>

        {spaceTags.length > 0 ? (
          <>
            <h4>Tags</h4>
            <div className="tag-cloud">
              {spaceTags.map((t) => (
                <Link key={t.id} href={`/documents?tag=${encodeURIComponent(t.name)}`} className="tag" data-on={activeTag === t.name}>
                  {t.name}
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </aside>

      <div className="kb-main">
        <div className="wrap fade-in">
          <div className="page-head">
            <div>
              <h1 className="page-title">{spaceName}</h1>
              <p className="page-sub">
                {total} document{total === 1 ? "" : "s"} · indexed for MCP retrieval
                {activeTag ? ` · filtered by #${activeTag}` : ""}
              </p>
            </div>
            <div className="actions">
              <ImportExportControls spaceId={spaceId} mayWrite={mayWrite} />
              {mayWrite ? (
                <form action={createDocumentAction}>
                  <button type="submit" className="btn btn-primary">New document</button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="toolbar">
            <div className="filter-input">
              <Search />
              <input placeholder="Search titles…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="seg">
              <Link href={href({ sort: "updated" })} data-on={sort === "updated"}>Updated</Link>
              <Link href={href({ sort: "title" })} data-on={sort === "title"}>A–Z</Link>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <Search />
              <h3>{q ? `No titles match “${q}”` : "No documents yet"}</h3>
              <p className="hint">Create a document, or have Claude/Codex write to your brain over the API.</p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Document</th>
                  <th style={{ width: 220 }}>Tags</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 140 }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} onClick={() => { window.location.href = `/documents/${d.id}`; }}>
                    <td>
                      <div className="doc-cell">
                        <span className="doc-ico"><File /></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="doc-title">{d.title}</div>
                          <div className="doc-path">/{d.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="tags-cell">
                        {d.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}
                      </div>
                    </td>
                    <td><span className="badge"><span className={`dot ${STATUS[d.indexStatus].dot}`} /> {STATUS[d.indexStatus].label}</span></td>
                    <td className="mono">{new Date(d.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {total > pageSize ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
              <span className="hint">{firstShown}–{lastShown} of {total}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {page > 1 ? <Link href={href({ sort, page: page - 1 })} className="btn btn-sm">Previous</Link> : <span className="btn btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>Previous</span>}
                <span className="hint" style={{ alignSelf: "center" }}>Page {page} / {totalPages}</span>
                {page < totalPages ? <Link href={href({ sort, page: page + 1 })} className="btn btn-sm">Next</Link> : <span className="btn btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>Next</span>}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
