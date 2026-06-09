"use client";

import { useActionState, useTransition } from "react";
import type { MemberView, SpaceRole } from "@ai-brain/core";
import { Button, Card, FieldError, Input } from "@/components/ui";
import {
  addMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  type SpaceFormState,
} from "../actions";

const ROLES: SpaceRole[] = ["viewer", "commenter", "editor", "owner"];
const initial: SpaceFormState = {};

export function MembersManager({
  spaceId,
  members,
  currentUserId,
}: {
  spaceId: string;
  members: MemberView[];
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState(addMemberAction.bind(null, spaceId), initial);
  const [, startTransition] = useTransition();

  const changeRole = (userId: string, role: string) => {
    const fd = new FormData();
    fd.set("spaceId", spaceId);
    fd.set("userId", userId);
    fd.set("role", role);
    startTransition(() => updateMemberRoleAction(fd));
  };
  const remove = (userId: string) => {
    const fd = new FormData();
    fd.set("spaceId", spaceId);
    fd.set("userId", userId);
    startTransition(() => removeMemberAction(fd));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 14.5, fontWeight: 600 }}>Invite a member</h2>
        <form action={action} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input name="email" type="email" placeholder="person@example.com" required />
            <FieldError>{state.error}</FieldError>
          </div>
          <select name="role" defaultValue="viewer" className="field" style={{ width: "auto" }}>
            {ROLES.filter((r) => r !== "owner").map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button type="submit" disabled={pending}>Add</Button>
        </form>
        <p className="hint" style={{ marginTop: 8 }}>The person must already have an account.</p>
      </Card>

      <div className="list">
        {members.map((m) => (
          <div key={m.userId} className="list-row">
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name ?? m.email}</p>
              <p className="faint" style={{ margin: 0, fontSize: 12 }}>{m.email}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} className="field" style={{ width: "auto", height: 30 }}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {m.userId !== currentUserId ? (
                <Button variant="danger" className="btn-sm" onClick={() => remove(m.userId)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
