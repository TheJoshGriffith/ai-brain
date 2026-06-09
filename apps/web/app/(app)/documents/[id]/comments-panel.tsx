"use client";

import { useActionState, useTransition } from "react";
import type { CommentView } from "@ai-brain/core";
import { Button, FieldError, Textarea } from "@/components/ui";
import { addCommentAction, removeCommentAction, type CommentFormState } from "./comment-actions";

export function CommentsPanel({
  documentId,
  comments,
  currentUserId,
  canComment,
  canManage,
}: {
  documentId: string;
  comments: CommentView[];
  currentUserId: string;
  canComment: boolean;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState<CommentFormState, FormData>(
    addCommentAction.bind(null, documentId),
    {},
  );
  const [, startTransition] = useTransition();

  return (
    <div className="meta-block">
      <h5>Comments {comments.length > 0 ? `(${comments.length})` : ""}</h5>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {comments.map((c) => (
          <div key={c.id} style={{ fontSize: 12.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 500 }}>{c.authorName ?? c.authorEmail}</span>
              <span className="faint" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
              {c.authorId === currentUserId || canManage ? (
                <button
                  type="button"
                  className="btn-danger"
                  style={{ background: "none", border: "none", padding: 0, fontSize: 11, cursor: "pointer" }}
                  onClick={() => startTransition(() => removeCommentAction(documentId, c.id))}
                >
                  delete
                </button>
              ) : null}
            </div>
            <p className="muted" style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}>{c.body}</p>
          </div>
        ))}
        {comments.length === 0 ? <p className="hint">No comments yet.</p> : null}
      </div>

      {canComment ? (
        <form action={action} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <Textarea name="body" rows={2} placeholder="Add a comment…" />
          <FieldError>{state.error}</FieldError>
          <div>
            <Button type="submit" variant="primary" className="btn-sm" disabled={pending}>
              {pending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
