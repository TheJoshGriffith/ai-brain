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
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-semibold">Invite a member</h2>
        <form action={action} className="flex items-start gap-2">
          <div className="flex-1">
            <Input name="email" type="email" placeholder="person@example.com" required />
            <FieldError>{state.error}</FieldError>
          </div>
          <select
            name="role"
            defaultValue="viewer"
            className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {ROLES.filter((r) => r !== "owner").map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button type="submit" disabled={pending}>Add</Button>
        </form>
        <p className="mt-2 text-xs text-gray-400">The person must already have an account.</p>
      </Card>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
              <p className="truncate text-xs text-gray-400">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={m.role}
                onChange={(e) => changeRole(m.userId, e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {m.userId !== currentUserId ? (
                <Button variant="danger" onClick={() => remove(m.userId)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
