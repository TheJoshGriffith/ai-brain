"use client";

import { useActionState, useState } from "react";
import type { TokenScope, TokenSummary } from "@ai-brain/core";
import { Button, Card, FieldError, Input, Label } from "@/components/ui";
import { createTokenAction, revokeTokenAction, type CreateTokenState } from "./actions";

const SCOPES: { value: TokenScope; label: string }[] = [
  { value: "documents:read", label: "Read documents" },
  { value: "documents:write", label: "Write documents" },
  { value: "search:read", label: "Search" },
];

const initial: CreateTokenState = {};

export function TokensClient({ tokens }: { tokens: TokenSummary[] }) {
  const [state, action, pending] = useActionState(createTokenAction, initial);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-8">
      {state.token ? (
        <Card className="border-brand-500/40 bg-brand-50/40 dark:bg-brand-500/5">
          <h3 className="font-semibold">Copy your new token now</h3>
          <p className="mt-1 text-sm text-gray-500">
            This is the only time it will be shown. Store it somewhere safe.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-gray-900 px-3 py-2 text-sm text-gray-100">
              {state.token}
            </code>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(state.token!);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 font-semibold">Create a token</h2>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. Claude Code on laptop" required />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Scopes</legend>
            {SCOPES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="scopes"
                  value={s.value}
                  defaultChecked={s.value !== "documents:write"}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                {s.label}
                <span className="text-xs text-gray-400">({s.value})</span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="expiresAt">Expires (optional)</Label>
            <Input id="expiresAt" name="expiresAt" type="date" />
          </div>
          <FieldError>{state.error}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending ? "Generating…" : "Generate token"}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">Your tokens</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-gray-400">
                    <code>{t.prefix}…</code> · {(t.scopes as string[]).join(", ")}
                    {t.lastUsedAt
                      ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                      : " · never used"}
                    {t.expiresAt ? ` · expires ${new Date(t.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <form action={revokeTokenAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" variant="danger">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
