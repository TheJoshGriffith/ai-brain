"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui";
import { deleteDocumentAction, saveDocumentAction } from "../actions";

type Status = "saved" | "dirty" | "saving" | "error";

const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
};

export function DocumentEditor({
  id,
  initialTitle,
  initialContent,
}: {
  id: string;
  initialTitle: string;
  initialContent: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<Status>("saved");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (t: string, c: string) => {
      setStatus("saving");
      startTransition(async () => {
        try {
          await saveDocumentAction(id, { title: t.trim() || undefined, content: c });
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      });
    },
    [id],
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

  const saveNow = () => {
    if (timer.current) clearTimeout(timer.current);
    save(title, content);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value, content);
          }}
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none"
        />
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={
              "text-xs " +
              (status === "error"
                ? "text-red-500"
                : status === "saved"
                  ? "text-gray-400"
                  : "text-brand-600")
            }
          >
            {STATUS_LABEL[status]}
          </span>
          <Button variant="ghost" onClick={saveNow}>
            Save
          </Button>
          <form action={deleteDocumentAction.bind(null, id)}>
            <Button variant="danger" type="submit">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleSave(title, e.target.value);
          }}
          spellCheck={false}
          className="h-full w-full resize-none rounded-md border border-gray-200 bg-white p-4 font-mono text-sm leading-relaxed outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900"
        />
        <div className="h-full overflow-y-auto rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <MarkdownPreview content={content} />
        </div>
      </div>
    </div>
  );
}
