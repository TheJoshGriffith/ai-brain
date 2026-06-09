"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
}: {
  docs: KbDoc[];
  spaceTags: { id: string; name: string }[];
  activeTag?: string;
  spaceName: string;
  spaceId: string;
  mayWrite: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "az">("updated");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
    const sorted = [...filtered].sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title) : +new Date(b.updatedAt) - +new Date(a.updatedAt),
    );
    return sorted;
  }, [docs, query, sort]);

  return (
    <div className="kb-grid">
      <aside className="kb-aside">
        <h4>Library</h4>
        <Link href="/documents" className="tree-item" data-active={!activeTag}>
          <Layers />
          All documents
          <span className="count">{docs.length}</span>
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
                {docs.length} document{docs.length === 1 ? "" : "s"} · indexed for MCP retrieval
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
              <input placeholder="Filter documents…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="seg">
              <button data-on={sort === "updated"} onClick={() => setSort("updated")}>Updated</button>
              <button data-on={sort === "az"} onClick={() => setSort("az")}>A–Z</button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <Search />
              <h3>No documents match</h3>
              <p className="hint">Try a different filter, or create a document.</p>
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
        </div>
      </div>
    </div>
  );
}
