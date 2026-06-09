"use client";

import { useActionState } from "react";
import { Button, FieldError, Input } from "@/components/ui";
import { createSpaceAction, type SpaceFormState } from "./actions";

const initial: SpaceFormState = {};

export function CreateSpaceForm() {
  const [state, action, pending] = useActionState(createSpaceAction, initial);
  return (
    <form action={action} className="flex items-start gap-2">
      <div className="flex-1">
        <Input name="name" placeholder="New space name" required />
        <FieldError>{state.error}</FieldError>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create space"}
      </Button>
    </form>
  );
}
