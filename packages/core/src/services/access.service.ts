import { and, eq } from "drizzle-orm";
import {
  documentMembers,
  documents,
  spaceMembers,
  type Database,
  type SpaceRole,
} from "@ai-brain/db";
import { canComment, canManage, canRead, canWrite, maxRole } from "../auth/roles";

export interface Access {
  role: SpaceRole;
  canRead: boolean;
  canComment: boolean;
  canWrite: boolean;
  canManage: boolean;
}

export interface DocumentAccess extends Access {
  documentId: string;
  spaceId: string;
}

function toAccess(role: SpaceRole): Access {
  return {
    role,
    canRead: canRead(role),
    canComment: canComment(role),
    canWrite: canWrite(role),
    canManage: canManage(role),
  };
}

/**
 * Single source of truth for "what can this user do here". Effective role is the
 * highest of the user's space-membership role and any per-document override.
 * (Public share-token grants are resolved separately in ShareService.)
 */
export class AccessService {
  constructor(private readonly db: Database) {}

  async resolveSpaceRole(userId: string, spaceId: string): Promise<SpaceRole | null> {
    const row = await this.db.query.spaceMembers.findFirst({
      where: and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)),
    });
    return row?.role ?? null;
  }

  async resolveSpaceAccess(userId: string, spaceId: string): Promise<Access | null> {
    const role = await this.resolveSpaceRole(userId, spaceId);
    return role ? toAccess(role) : null;
  }

  /** Returns the user's effective access to a document, or null if none/missing. */
  async resolveDocumentAccess(userId: string, documentId: string): Promise<DocumentAccess | null> {
    const [row] = await this.db
      .select({
        spaceId: documents.spaceId,
        spaceRole: spaceMembers.role,
        docRole: documentMembers.role,
      })
      .from(documents)
      .leftJoin(
        spaceMembers,
        and(eq(spaceMembers.spaceId, documents.spaceId), eq(spaceMembers.userId, userId)),
      )
      .leftJoin(
        documentMembers,
        and(eq(documentMembers.documentId, documents.id), eq(documentMembers.userId, userId)),
      )
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!row) return null; // document doesn't exist
    const role = maxRole(row.spaceRole, row.docRole);
    if (!role) return null; // no access
    return { documentId, spaceId: row.spaceId, ...toAccess(role) };
  }
}
