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
    <div className="flex flex-wrap items-center gap-2">
      {tags.length === 0 && !canWrite ? <span className="text-xs text-gray-400">No tags</span> : null}
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
        >
          #{t}
          {canWrite ? (
            <button
              type="button"
              onClick={() => commit(tags.filter((x) => x !== t))}
              className="text-brand-400 hover:text-brand-700"
              aria-label={`Remove ${t}`}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="add tag…"
          className="w-24 bg-transparent text-xs outline-none placeholder:text-gray-400"
        />
      ) : null}
    </div>
  );
}
