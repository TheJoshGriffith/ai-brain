import { and, desc, eq } from "drizzle-orm";
import {
  documentMembers,
  documentShares,
  users,
  type Database,
  type DocumentShare,
  type SpaceRole,
} from "@ai-brain/db";
import { z } from "zod";
import { generateToken, hashToken } from "../auth/token";
import { ROLE_RANK } from "../auth/roles";
import { AccessService } from "./access.service";
import { DocumentForbiddenError, DocumentNotFoundError } from "./document.service";
import type { MemberView } from "./space.service";

export const SHARE_ROLES = ["viewer", "commenter", "editor"] as const;

export const createLinkSchema = z.object({
  role: z.enum(SHARE_ROLES).default("viewer"),
  allowAnonymous: z.boolean().default(false),
  expiresAt: z.coerce.date().optional(),
});
export type CreateLinkInput = z.input<typeof createLinkSchema>;

export const addDocMemberSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(SHARE_ROLES),
});

export type ShareSummary = Omit<DocumentShare, "tokenHash">;
export interface ShareGrant {
  resourceType: "document" | "space";
  resourceId: string;
  role: SpaceRole;
  allowAnonymous: boolean;
}

const summarize = (s: DocumentShare): ShareSummary => {
  const { tokenHash: _omit, ...rest } = s;
  return rest;
};
/** Caps the granted role so a link/override never exceeds the granter's role or editor. */
const capRole = (requested: SpaceRole, granter: SpaceRole): SpaceRole => {
  const ceiling = Math.min(ROLE_RANK[granter], ROLE_RANK.editor);
  return ROLE_RANK[requested] <= ceiling ? requested : (["viewer", "commenter", "editor"] as SpaceRole[])[ceiling]!;
};

export class SharingService {
  private readonly access: AccessService;
  constructor(private readonly db: Database) {
    this.access = new AccessService(db);
  }

  // --- Public share links --------------------------------------------------

  /** Create a public link to a document. Requires write access to the document. */
  async createDocumentLink(
    actorId: string,
    documentId: string,
    input: CreateLinkInput,
  ): Promise<{ token: string; share: ShareSummary }> {
    const acc = await this.access.resolveDocumentAccess(actorId, documentId);
    if (!acc) throw new DocumentNotFoundError();
    if (!acc.canWrite) throw new DocumentForbiddenError();

    const { role, allowAnonymous, expiresAt } = createLinkSchema.parse(input);
    const generated = generateToken();
    const [row] = await this.db
      .insert(documentShares)
      .values({
        resourceType: "document",
        resourceId: documentId,
        role: capRole(role, acc.role),
        allowAnonymous,
        tokenHash: generated.hash,
        prefix: generated.prefix,
        createdBy: actorId,
        expiresAt: expiresAt ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create share link");
    return { token: generated.raw, share: summarize(row) };
  }

  async listDocumentLinks(actorId: string, documentId: string): Promise<ShareSummary[]> {
    const acc = await this.access.resolveDocumentAccess(actorId, documentId);
    if (!acc?.canWrite) throw new DocumentForbiddenError();
    const rows = await this.db
      .select()
      .from(documentShares)
      .where(and(eq(documentShares.resourceType, "document"), eq(documentShares.resourceId, documentId)))
      .orderBy(desc(documentShares.createdAt));
    return rows.map(summarize);
  }

  async revokeLink(actorId: string, shareId: string): Promise<void> {
    const share = await this.db.query.documentShares.findFirst({ where: eq(documentShares.id, shareId) });
    if (!share) return;
    if (share.resourceType === "document") {
      const acc = await this.access.resolveDocumentAccess(actorId, share.resourceId);
      if (!acc?.canWrite) throw new DocumentForbiddenError();
    } else if ((await this.access.resolveSpaceRole(actorId, share.resourceId)) !== "owner") {
      throw new DocumentForbiddenError();
    }
    await this.db.delete(documentShares).where(eq(documentShares.id, shareId));
  }

  /** Resolve a raw share token to a grant, or null if invalid/expired. */
  async resolveToken(rawToken: string): Promise<ShareGrant | null> {
    if (!rawToken) return null;
    const row = await this.db.query.documentShares.findFirst({
      where: eq(documentShares.tokenHash, hashToken(rawToken)),
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
    return {
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      role: row.role,
      allowAnonymous: row.allowAnonymous,
    };
  }

  // --- Per-document member overrides --------------------------------------

  async addDocumentMember(
    actorId: string,
    documentId: string,
    input: { email: string; role: SpaceRole },
  ): Promise<MemberView> {
    const acc = await this.access.resolveDocumentAccess(actorId, documentId);
    if (!acc) throw new DocumentNotFoundError();
    if (!acc.canWrite) throw new DocumentForbiddenError();
    const { email, role } = addDocMemberSchema.parse(input);

    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) throw new DocumentForbiddenError(); // surfaced as a generic message by callers
    const capped = capRole(role, acc.role);

    await this.db
      .insert(documentMembers)
      .values({ documentId, userId: user.id, role: capped })
      .onConflictDoUpdate({ target: [documentMembers.documentId, documentMembers.userId], set: { role: capped } });
    return { userId: user.id, email: user.email, name: user.name, role: capped };
  }

  async listDocumentMembers(actorId: string, documentId: string): Promise<MemberView[]> {
    const acc = await this.access.resolveDocumentAccess(actorId, documentId);
    if (!acc?.canRead) throw new DocumentForbiddenError();
    return this.db
      .select({ userId: users.id, email: users.email, name: users.name, role: documentMembers.role })
      .from(documentMembers)
      .innerJoin(users, eq(users.id, documentMembers.userId))
      .where(eq(documentMembers.documentId, documentId));
  }

  async removeDocumentMember(actorId: string, documentId: string, targetUserId: string): Promise<void> {
    const acc = await this.access.resolveDocumentAccess(actorId, documentId);
    if (!acc?.canWrite) throw new DocumentForbiddenError();
    await this.db
      .delete(documentMembers)
      .where(and(eq(documentMembers.documentId, documentId), eq(documentMembers.userId, targetUserId)));
  }

  /** A logged-in user claims a share link's role as a per-document override. */
  async claimDocumentLink(userId: string, rawToken: string): Promise<string | null> {
    const grant = await this.resolveToken(rawToken);
    if (!grant || grant.resourceType !== "document") return null;
    await this.db
      .insert(documentMembers)
      .values({ documentId: grant.resourceId, userId, role: grant.role })
      .onConflictDoUpdate({ target: [documentMembers.documentId, documentMembers.userId], set: { role: grant.role } });
    return grant.resourceId;
  }
}
