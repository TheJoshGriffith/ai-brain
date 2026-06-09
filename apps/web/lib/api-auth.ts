import "server-only";
import { NextResponse } from "next/server";
import { parseBearer, type TokenScope } from "@ai-brain/core";
import { auth } from "@/auth";
import { tokenService } from "@/lib/services";

export interface ApiPrincipal {
  userId: string;
  /** "*" for an interactive session (full access); a scope list for a PAT. */
  scopes: TokenScope[] | "*";
}

/**
 * Authenticates a REST request via PAT bearer token (preferred for tooling)
 * or, failing that, the interactive session cookie. Returns null if neither.
 */
export async function authenticateRequest(req: Request): Promise<ApiPrincipal | null> {
  const bearer = parseBearer(req.headers.get("authorization"));
  if (bearer) {
    const principal = await tokenService().authenticate(bearer);
    return principal ? { userId: principal.userId, scopes: principal.scopes } : null;
  }
  const session = await auth();
  if (session?.user) return { userId: session.user.id, scopes: "*" };
  return null;
}

export function hasScope(principal: ApiPrincipal, scope: TokenScope): boolean {
  return principal.scopes === "*" || principal.scopes.includes(scope);
}

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const forbidden = (scope: string) =>
  NextResponse.json({ error: `Token is missing required scope: ${scope}` }, { status: 403 });
