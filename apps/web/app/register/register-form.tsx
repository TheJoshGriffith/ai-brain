"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, FieldError, Input, Label } from "@/components/ui";
import type { AuthFormState } from "@/app/login/actions";
import { registerAction } from "./actions";

const initial: AuthFormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="hint">At least 8 characters.</p>
      </div>
      <FieldError>{state.error}</FieldError>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center hint">
        Already have an account?{" "}
        <Link href="/login" className="font-medium link-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}
