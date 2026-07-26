"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { deleteDocumentAction, saveDocumentAction } from "../actions";

type Status = "saved" | "dirty" | "saving" | "error";
type Mode = "edit" | "split" | "preview";

const STATUS_LABEL: Record<Status, string> = {
  saved: "saved",
  dirty: "unsaved",
  saving: "saving…",
  error: "save failed",
};

export function DocumentEditor({
  id,
  initialTitle,
  initialContent,
  initialRevision,
  readOnly = false,
}: {
  id: string;
  initialTitle: string;
  initialContent: string;
  initialRevision: number;
  readOnly?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<Status>("saved");
  const [mode, setMode] = useState<Mode>("preview");
  const [conflict, setConflict] = useState(false);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(initialRevision);

  const save = useCallback(
    (t: string, c: string) => {
      if (conflict) return;
      setStatus("saving");
      startTransition(async () => {
        try {
          const result = await saveDocumentAction(id, {
            title: t.trim() || undefined,
            content: c,
            expectedRevision: revision.current,
          });
          if (result.ok) {
            revision.current = result.revision;
            setStatus("saved");
          } else {
            setConflict(true);
            setStatus("error");
          }
        } catch {
          setStatus("error");
        }
      });
    },
    [id, conflict],
  );

  const scheduleSave = useCallback(
    (t: string, c: string) => {
      setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(t, c), 1200);
    },
    [save],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  const titleInput = (
    <input
      value={title}
      readOnly={readOnly}
      onChange={(e) => { setTitle(e.target.value); scheduleSave(e.target.value, content); }}
      placeholder="Untitled"
      className="doc-h1"
    />
  );
  const textarea = (
    <textarea
      value={content}
      readOnly={readOnly}
      onChange={(e) => { setContent(e.target.value); scheduleSave(title, e.target.value); }}
      spellCheck={false}
      className="editor-area"
    />
  );

  return (
    <div className="editor-main">
      {conflict ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 22px", background: "color-mix(in oklch, oklch(0.78 0.16 75) 14%, transparent)", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
          <span>This document was changed elsewhere (an agent or another person). Reload to get the latest — unsaved local edits will be lost.</span>
          <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>Reload</button>
        </div>
      ) : null}
      <div className="editor-bar">
        <Link href="/documents" className="icon-btn" title="Back"><ChevronLeft /></Link>
        {!readOnly ? (
          <div className="seg">
            <button data-on={mode === "edit"} onClick={() => setMode("edit")}>Edit</button>
            <button data-on={mode === "split"} onClick={() => setMode("split")}>Split</button>
            <button data-on={mode === "preview"} onClick={() => setMode("preview")}>Preview</button>
          </div>
        ) : (
          <span className="badge"><span className="dot dot-gray" /> read only</span>
        )}
        <div className="spacer" />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
          {words} words · {STATUS_LABEL[status]}{status === "saved" ? <> via <span style={{ color: "var(--accent)" }}>write_doc</span></> : null}
        </span>
        {!readOnly ? (
          <>
            <button
              className="btn btn-sm"
              onClick={() => { if (timer.current) clearTimeout(timer.current); save(title, content); }}
            >
              <Check /> Save
            </button>
            <form action={deleteDocumentAction.bind(null, id)}>
              <button type="submit" className="btn btn-ghost btn-sm" style={{ color: "var(--fg-muted)" }}>Delete</button>
            </form>
          </>
        ) : null}
      </div>

      {mode === "split" ? (
        <div className="editor-split">
          <div className="editor-scroll">
            <div className="editor-paper">{titleInput}{textarea}</div>
          </div>
          <div className="editor-scroll">
            <div className="editor-paper"><MarkdownPreview content={content} /></div>
          </div>
        </div>
      ) : (
        <div className="editor-scroll">
          <div className="editor-paper">
            {mode === "preview" ? (
              <>
                <h1 className="doc-h1" style={{ pointerEvents: "none" }}>{title || "Untitled"}</h1>
                <MarkdownPreview content={content} />
              </>
            ) : (
              <>{titleInput}{textarea}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
