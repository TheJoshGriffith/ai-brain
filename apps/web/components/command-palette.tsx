"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File, Search } from "lucide-react";

interface Result {
  documentId: string;
  title: string;
  slug: string;
  snippet: string | null;
  score: number;
  matched: ("fulltext" | "semantic")[];
}

/** Renders a ts_headline snippet (<<term>>) with highlighted marks. */
function snippetHtml(text: string | null): string {
  if (!text) return "";
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/&lt;&lt;(.+?)&gt;&gt;/g, "<mark>$1</mark>");
}

export function CommandPalette({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"semantic" | "fulltext">("semantic");
  const [results, setResults] = useState<Result[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?spaceId=${spaceId}&q=${encodeURIComponent(term)}&limit=8`);
        const data = await res.json();
        setResults(data.results ?? []);
        setSel(0);
      } catch {
        setResults([]);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q, spaceId]);

  const open = (id: string) => { onClose(); router.push(`/documents/${id}`); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter" && results[sel]) { open(results[sel]!.documentId); }
    else if (e.key === "Escape") { onClose(); }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="palette-in">
          <Search />
          <input ref={inputRef} placeholder="Search the knowledge base…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="palette-mode">
            <button data-on={mode === "semantic"} onClick={() => setMode("semantic")}>semantic</button>
            <button data-on={mode === "fulltext"} onClick={() => setMode("fulltext")}>full-text</button>
          </div>
        </div>

        <div className="palette-list">
          <div className="palette-sec">
            {q.trim()
              ? `${results.length} result${results.length === 1 ? "" : "s"} · hybrid full-text + vector`
              : "Type to search"}
          </div>
          {q.trim() && results.length === 0 ? (
            <div className="empty" style={{ padding: "30px 10px" }}>
              <Search />
              <h3>No matches</h3>
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.documentId}
                className="palette-item"
                data-active={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => open(r.documentId)}
              >
                <span className="ico"><File /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="pi-title">{r.title}</div>
                  <div className="pi-snip" dangerouslySetInnerHTML={{ __html: snippetHtml(r.snippet) }} />
                </div>
                {r.matched.includes("semantic") ? <span className="score">{Math.round(r.score * 1000)}</span> : null}
                <span className="pi-path">/{r.slug}</span>
              </div>
            ))
          )}
        </div>

        <div className="palette-foot">
          <span className="grp"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="grp"><span className="kbd">↵</span> open</span>
          <span className="grp"><span className="kbd">esc</span> close</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
            via <span style={{ color: "var(--accent)" }}>search_docs</span>
          </span>
        </div>
      </div>
    </div>
  );
}
