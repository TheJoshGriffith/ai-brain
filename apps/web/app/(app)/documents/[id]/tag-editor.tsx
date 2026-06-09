"use client";

import { useState, useTransition } from "react";
import { setDocumentTagsAction } from "../actions";

export function TagEditor({
  documentId,
  initialTags,
  canWrite,
}: {
  documentId: string;
  initialTags: string[];
  canWrite: boolean;
}) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  const commit = (next: string[]) => {
    setTags(next);
    startTransition(async () => {
      const saved = await setDocumentTagsAction(documentId, next);
      setTags(saved);
    });
  };
  const add = () => {
    const name = draft.trim().toLowerCase();
    if (name && !tags.includes(name)) commit([...tags, name]);
    setDraft("");
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
      {tags.length === 0 && !canWrite ? <span className="hint">No tags</span> : null}
      {tags.map((t) => (
        <span key={t} className="tag" data-on="true" style={{ cursor: "default" }}>
          {t}
          {canWrite ? (
            <button
              type="button"
              onClick={() => commit(tags.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "0 0 0 2px", lineHeight: 1 }}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {canWrite ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          onBlur={add}
          placeholder="+ add tag"
          style={{ width: 80, background: "none", border: "none", outline: "none", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}
        />
      ) : null}
    </div>
  );
}
