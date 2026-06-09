"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, FieldError, Input, Label } from "@/components/ui";
import { loginAction, type AuthFormState } from "./actions";

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
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
          autoComplete="current-password"
          required
        />
      </div>
      <FieldError>{state.error}</FieldError>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center" style={{ marginTop: -4 }}>
        <Link href="/forgot" className="hint link-accent" style={{ fontSize: 12.5 }}>Forgot password?</Link>
      </p>
      <p className="text-center hint">
        No account?{" "}
        <Link href="/register" className="font-medium link-accent">
          Create one
        </Link>
      </p>
    </form>
  );
}
