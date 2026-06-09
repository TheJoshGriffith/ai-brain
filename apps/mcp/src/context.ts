import { getDb } from "@ai-brain/db";
import {
  CommentService,
  DocumentService,
  LinkService,
  SearchService,
  SpaceService,
  TagService,
  TokenService,
  type TokenScope,
} from "@ai-brain/core";

/** Everything a tool handler needs, scoped to one authenticated user/token. */
export interface McpContext {
  userId: string;
  scopes: TokenScope[];
  documents: DocumentService;
  links: LinkService;
  search: SearchService;
  spaces: SpaceService;
  tags: TagService;
  comments: CommentService;
}

/** Resolves a PAT to a scoped context, or null if the token is invalid. */
export async function authenticate(token: string | undefined): Promise<McpContext | null> {
  if (!token) return null;
  const db = getDb();
  const principal = await new TokenService(db).authenticate(token);
  if (!principal) return null;
  return {
    userId: principal.userId,
    scopes: principal.scopes,
    documents: new DocumentService(db),
    links: new LinkService(db),
    search: new SearchService(db),
    spaces: new SpaceService(db),
    tags: new TagService(db),
    comments: new CommentService(db),
  };
}

export class ScopeError extends Error {
  constructor(scope: TokenScope) {
    super(`This token is missing the required scope: ${scope}`);
  }
}

export function requireScope(ctx: McpContext, scope: TokenScope): void {
  if (!ctx.scopes.includes(scope)) throw new ScopeError(scope);
}
