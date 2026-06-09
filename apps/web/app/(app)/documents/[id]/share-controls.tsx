"use client";

import { useActionState, useState, useTransition } from "react";
import type { MemberView, ShareSummary, SpaceRole } from "@ai-brain/core";
import { Button, FieldError, Input } from "@/components/ui";
import {
  addDocMemberAction,
  createShareLinkAction,
  removeDocMemberAction,
  revokeShareLinkAction,
  type AddMemberState,
  type CreateLinkState,
} from "./share-actions";

const ROLES: SpaceRole[] = ["viewer", "commenter", "editor"];

export function ShareControls({
  documentId,
  members,
  links,
}: {
  documentId: string;
  members: MemberView[];
  links: ShareSummary[];
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [memberState, addMember, addingMember] = useActionState<AddMemberState, FormData>(
    addDocMemberAction.bind(null, documentId),
    {},
  );
  const [linkState, createLink, creatingLink] = useActionState<CreateLinkState, FormData>(
    createShareLinkAction.bind(null, documentId),
    {},
  );
  const [copied, setCopied] = useState(false);

  const shareUrl = linkState.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${linkState.token}`
    : "";

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
        Share
      </Button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-96 space-y-5 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {/* People */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">People</h3>
            <form action={addMember} className="flex items-start gap-2">
              <Input name="email" type="email" placeholder="person@example.com" required className="flex-1" />
              <select name="role" defaultValue="viewer" className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button type="submit" disabled={addingMember}>Add</Button>
            </form>
            <FieldError>{memberState.error}</FieldError>
            <ul className="mt-2 space-y-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{m.email} <span className="text-xs text-gray-400">· {m.role}</span></span>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => startTransition(() => removeDocMemberAction(documentId, m.userId))}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Public links */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Public link</h3>
            <form action={createLink} className="flex items-center gap-2">
              <select name="role" defaultValue="viewer" className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" name="allowAnonymous" /> anonymous
              </label>
              <Button type="submit" disabled={creatingLink}>Create</Button>
            </form>
            <FieldError>{linkState.error}</FieldError>
            {shareUrl ? (
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-gray-900 px-2 py-1 text-xs text-gray-100">{shareUrl}</code>
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:underline"
                  onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); }}
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            ) : null}
            <ul className="mt-2 space-y-1">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs text-gray-500">
                  <span><code>{l.prefix}…</code> · {l.role}{l.allowAnonymous ? " · anonymous" : ""}{l.expiresAt ? ` · expires ${new Date(l.expiresAt).toLocaleDateString()}` : ""}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:underline"
                    onClick={() => startTransition(() => revokeShareLinkAction(documentId, l.id))}
                  >
                    revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
