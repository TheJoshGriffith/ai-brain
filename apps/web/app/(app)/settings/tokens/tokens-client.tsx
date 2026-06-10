"use client";

import { useActionState, useState } from "react";
import type { TokenScope, TokenSummary } from "@ai-brain/core";
import { Button, Card, FieldError, Input, Label } from "@/components/ui";
import { createTokenAction, revokeTokenAction, type CreateTokenState } from "./actions";

const SCOPES: { value: TokenScope; label: string }[] = [
  { value: "documents:read", label: "Read documents" },
  { value: "documents:write", label: "Write documents" },
  { value: "documents:delete", label: "Delete documents (trash)" },
  { value: "documents:purge", label: "Purge trash (permanent)" },
  { value: "search:read", label: "Search" },
  { value: "spaces:read", label: "Read spaces" },
  { value: "spaces:write", label: "Manage spaces & members" },
];

const initial: CreateTokenState = {};

export function TokensClient({ tokens }: { tokens: TokenSummary[] }) {
  const [state, action, pending] = useActionState(createTokenAction, initial);
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {state.token ? (
        <Card style={{ borderColor: "var(--accent-line)", background: "var(--accent-soft)" }}>
          <h3 style={{ margin: 0, fontWeight: 600 }}>Copy your new token now</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            This is the only time it will be shown. Store it somewhere safe.
          </p>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <code className="code-field" style={{ flex: 1 }}>{state.token}</code>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => { await navigator.clipboard.writeText(state.token!); setCopied(true); }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 style={{ margin: "0 0 16px", fontWeight: 600 }}>Create a token</h2>
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. Claude Code on laptop" required />
          </div>
          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend className="form-label" style={{ padding: 0 }}>Scopes</legend>
            {SCOPES.map((s) => (
              <label key={s.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" name="scopes" value={s.value} defaultChecked={s.value !== "documents:write"} style={{ accentColor: "var(--accent)" }} />
                {s.label}
                <span className="faint" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>({s.value})</span>
              </label>
            ))}
          </fieldset>
          <div>
            <Label htmlFor="expiresAt">Expires (optional)</Label>
            <Input id="expiresAt" name="expiresAt" type="date" />
          </div>
          <FieldError>{state.error}</FieldError>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Generating…" : "Generate token"}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 style={{ margin: "0 0 12px", fontWeight: 600 }}>Your tokens</h2>
        {tokens.length === 0 ? (
          <p className="hint">No tokens yet.</p>
        ) : (
          <div className="list">
            {tokens.map((t) => (
              <div key={t.id} className="list-row">
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{t.name}</p>
                  <p className="faint" style={{ margin: 0, fontSize: 12 }}>
                    <code style={{ fontFamily: "var(--font-mono)" }}>{t.prefix}…</code> · {(t.scopes as string[]).join(", ")}
                    {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : " · never used"}
                    {t.expiresAt ? ` · expires ${new Date(t.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <form action={revokeTokenAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" variant="danger" className="btn-sm">Revoke</Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
