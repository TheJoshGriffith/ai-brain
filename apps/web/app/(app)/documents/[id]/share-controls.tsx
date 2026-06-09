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
    <div>
      <Button variant="ghost" className="btn-sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : "Share…"}
      </Button>
      {open ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="form-label">People</div>
            <form action={addMember} style={{ display: "flex", gap: 6 }}>
              <Input name="email" type="email" placeholder="person@example.com" required style={{ flex: 1 }} />
              <select name="role" defaultValue="viewer" className="field" style={{ width: "auto" }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button type="submit" className="btn-sm" disabled={addingMember}>Add</Button>
            </form>
            <FieldError>{memberState.error}</FieldError>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {members.map((m) => (
                <div key={m.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.email} · {m.role}
                  </span>
                  <button
                    type="button" className="btn-danger" style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, cursor: "pointer" }}
                    onClick={() => startTransition(() => removeDocMemberAction(documentId, m.userId))}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="form-label">Public link</div>
            <form action={createLink} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select name="role" defaultValue="viewer" className="field" style={{ width: "auto" }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="hint" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" name="allowAnonymous" /> anonymous
              </label>
              <Button type="submit" className="btn-sm" disabled={creatingLink}>Create</Button>
            </form>
            <FieldError>{linkState.error}</FieldError>
            {shareUrl ? (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <code className="code-field" style={{ flex: 1, fontSize: 11 }}>{shareUrl}</code>
                <button
                  type="button" className="link-accent" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5 }}
                  onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); }}
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            ) : null}
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {links.map((l) => (
                <div key={l.id} className="faint" style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span><code style={{ fontFamily: "var(--font-mono)" }}>{l.prefix}…</code> · {l.role}{l.allowAnonymous ? " · anonymous" : ""}</span>
                  <button
                    type="button" className="btn-danger" style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, cursor: "pointer" }}
                    onClick={() => startTransition(() => revokeShareLinkAction(documentId, l.id))}
                  >
                    revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
