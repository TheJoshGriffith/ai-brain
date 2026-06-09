import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  documentTags,
  documents,
  tags,
  type Database,
  type Tag,
} from "@ai-brain/db";
import { AccessService } from "./access.service";
import { DocumentForbiddenError, DocumentNotFoundError, type DocumentSummary } from "./document.service";

/** Normalises a tag name: trimmed, lower-cased, collapsed whitespace. */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

export class TagService {
  private readonly access: AccessService;
  constructor(private readonly db: Database) {
    this.access = new AccessService(db);
  }

  /** All tags defined in a space (requires membership). */
  async listForSpace(userId: string, spaceId: string): Promise<Tag[]> {
    if (!(await this.access.resolveSpaceRole(userId, spaceId))) throw new DocumentForbiddenError();
    return this.db.select().from(tags).where(eq(tags.spaceId, spaceId)).orderBy(asc(tags.name));
  }

  /** Tag names keyed by document id, for a batch of documents. */
  async tagsByDocuments(documentIds: string[]): Promise<Record<string, string[]>> {
    if (documentIds.length === 0) return {};
    const rows = await this.db
      .select({ documentId: documentTags.documentId, name: tags.name })
      .from(documentTags)
      .innerJoin(tags, eq(tags.id, documentTags.tagId))
      .where(inArray(documentTags.documentId, documentIds))
      .orderBy(asc(tags.name));
    const map: Record<string, string[]> = {};
    for (const r of rows) (map[r.documentId] ??= []).push(r.name);
    return map;
  }

  /** Tag names on a document (no access check — callers gate via the document). */
  async getDocumentTags(documentId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: tags.name })
      .from(documentTags)
      .innerJoin(tags, eq(tags.id, documentTags.tagId))
      .where(eq(documentTags.documentId, documentId))
      .orderBy(asc(tags.name));
    return rows.map((r) => r.name);
  }

  /**
   * Replaces a document's tags with the given names. Requires write access.
   * Tags are created in the document's space on demand.
   */
  async setDocumentTags(userId: string, documentId: string, names: string[]): Promise<string[]> {
    const acc = await this.access.resolveDocumentAccess(userId, documentId);
    if (!acc) throw new DocumentNotFoundError();
    if (!acc.canWrite) throw new DocumentForbiddenError();

    const normalized = [...new Set(names.map(normalizeTag).filter(Boolean))];

    await this.db.transaction(async (tx) => {
      await tx.delete(documentTags).where(eq(documentTags.documentId, documentId));
      if (normalized.length === 0) return;

      // Upsert tags in the space, then resolve their ids.
      await tx
        .insert(tags)
        .values(normalized.map((name) => ({ spaceId: acc.spaceId, name })))
        .onConflictDoNothing({ target: [tags.spaceId, tags.name] });
      const rows = await tx
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(and(eq(tags.spaceId, acc.spaceId), inArray(tags.name, normalized)));

      await tx.insert(documentTags).values(rows.map((t) => ({ documentId, tagId: t.id })));
    });

    return normalized;
  }

  /** Documents in a space carrying a given tag (requires membership). */
  async listDocumentsByTag(userId: string, spaceId: string, name: string): Promise<DocumentSummary[]> {
    if (!(await this.access.resolveSpaceRole(userId, spaceId))) throw new DocumentForbiddenError();
    return this.db
      .select({
        id: documents.id,
        title: documents.title,
        slug: documents.slug,
        updatedAt: documents.updatedAt,
        createdAt: documents.createdAt,
        indexStatus: documents.indexStatus,
      })
      .from(documentTags)
      .innerJoin(tags, eq(tags.id, documentTags.tagId))
      .innerJoin(documents, eq(documents.id, documentTags.documentId))
      .where(and(eq(tags.spaceId, spaceId), eq(tags.name, normalizeTag(name))))
      .orderBy(desc(documents.updatedAt));
  }
}
