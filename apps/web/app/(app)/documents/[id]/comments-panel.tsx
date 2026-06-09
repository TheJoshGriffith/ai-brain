"use client";

import { useActionState, useTransition } from "react";
import type { CommentView } from "@ai-brain/core";
import { Button, FieldError } from "@/components/ui";
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
    <section className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-500">
        Comments {comments.length > 0 ? `(${comments.length})` : ""}
      </h2>

      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{c.authorName ?? c.authorEmail}</span>
              <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
              {c.authorId === currentUserId || canManage ? (
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => startTransition(() => removeCommentAction(documentId, c.id))}
                >
                  delete
                </button>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 ? <li className="text-sm text-gray-400">No comments yet.</li> : null}
      </ul>

      {canComment ? (
        <form action={action} className="mt-4 space-y-2">
          <textarea
            name="body"
            rows={2}
            placeholder="Add a comment…"
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900"
          />
          <FieldError>{state.error}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending ? "Posting…" : "Comment"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
