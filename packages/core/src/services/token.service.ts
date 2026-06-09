import { and, desc, eq } from "drizzle-orm";
import {
  personalAccessTokens,
  type Database,
  type PersonalAccessToken,
} from "@ai-brain/db";
import { z } from "zod";
import { generateToken, hashToken, TOKEN_SCOPES, type TokenScope } from "../auth/token";

export const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(TOKEN_SCOPES)).min(1),
  /** Optional absolute expiry; omit for a non-expiring token. */
  expiresAt: z.coerce.date().optional(),
});
export type CreateTokenInput = z.infer<typeof createTokenSchema>;

/** Authenticated identity resolved from a PAT. */
export interface Principal {
  userId: string;
  tokenId: string;
  scopes: TokenScope[];
}

/** Public (non-secret) view of a token for listings. */
export type TokenSummary = Omit<PersonalAccessToken, "tokenHash">;

function toSummary(row: PersonalAccessToken): TokenSummary {
  const { tokenHash: _omit, ...summary } = row;
  return summary;
}

export class TokenService {
  constructor(private readonly db: Database) {}

  /** Mints a token. The raw secret is returned ONCE and never stored. */
  async create(
    userId: string,
    input: CreateTokenInput,
  ): Promise<{ token: string; summary: TokenSummary }> {
    const { name, scopes, expiresAt } = createTokenSchema.parse(input);
    const generated = generateToken();

    const [row] = await this.db
      .insert(personalAccessTokens)
      .values({
        userId,
        name,
        tokenHash: generated.hash,
        prefix: generated.prefix,
        scopes,
        expiresAt: expiresAt ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create token");

    return { token: generated.raw, summary: toSummary(row) };
  }

  list(userId: string): Promise<TokenSummary[]> {
    return this.db
      .select()
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.userId, userId))
      .orderBy(desc(personalAccessTokens.createdAt))
      .then((rows) => rows.map(toSummary));
  }

  async revoke(userId: string, tokenId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(personalAccessTokens)
      .where(
        and(
          eq(personalAccessTokens.id, tokenId),
          eq(personalAccessTokens.userId, userId),
        ),
      )
      .returning({ id: personalAccessTokens.id });
    return deleted.length > 0;
  }

  /**
   * Resolves a raw bearer token to a Principal, or null if invalid/expired.
   * Bumps last_used_at on success.
   */
  async authenticate(rawToken: string): Promise<Principal | null> {
    if (!rawToken) return null;
    const hash = hashToken(rawToken);

    const row = await this.db.query.personalAccessTokens.findFirst({
      where: eq(personalAccessTokens.tokenHash, hash),
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

    await this.db
      .update(personalAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(personalAccessTokens.id, row.id));

    return {
      userId: row.userId,
      tokenId: row.id,
      scopes: (row.scopes as TokenScope[]) ?? [],
    };
  }
}

/** Extracts a bearer token from an Authorization header value. */
export function parseBearer(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() ?? null;
}
