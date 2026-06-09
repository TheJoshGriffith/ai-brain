"use client";

import { useActionState } from "react";
import { Button, FieldError, Input } from "@/components/ui";
import { createInviteAction, type InviteState } from "./actions";

const initial: InviteState = {};

export function InviteForm() {
  const [state, action, pending] = useActionState(createInviteAction, initial);
  return (
    <div>
      <form action={action} style={{ display: "flex", gap: 8 }}>
        <Input name="email" type="email" placeholder="person@example.com" required style={{ flex: 1 }} />
        <Button type="submit" disabled={pending}>Create invite</Button>
      </form>
      <FieldError>{state.error}</FieldError>
      {state.url ? (
        <div style={{ marginTop: 8 }}>
          <p className="hint" style={{ marginBottom: 4 }}>Invite link (also emailed):</p>
          <code className="code-field">{state.url}</code>
        </div>
      ) : null}
    </div>
  );
}
