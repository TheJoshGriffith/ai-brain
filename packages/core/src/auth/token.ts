import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKEN_PREFIX = "aib";

/** Available PAT scopes. Keep in sync with the settings UI. */
export const TOKEN_SCOPES = [
  "documents:read",
  "documents:write",
  "search:read",
] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export interface GeneratedToken {
  /** The full secret shown to the user exactly once: `aib_<base64url>`. */
  raw: string;
  /** Stored, indexed lookup value (sha256 hex of `raw`). */
  hash: string;
  /** Non-secret display hint, e.g. `aib_a1b2c3d4`. */
  prefix: string;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): GeneratedToken {
  const secret = randomBytes(32).toString("base64url");
  const raw = `${TOKEN_PREFIX}_${secret}`;
  return {
    raw,
    hash: hashToken(raw),
    prefix: `${TOKEN_PREFIX}_${secret.slice(0, 8)}`,
  };
}

/** Constant-time comparison of two sha256 hex digests. */
export function safeHashEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
