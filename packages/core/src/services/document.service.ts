import { and, desc, eq, isNotNull, isNull, like, lt, ne } from "drizzle-orm";
import {
  documentVersions,
  documents,
  type Database,
  type Document,
  type DocumentVersion,
} from "@ai-brain/db";
import { z } from "zod";
import { deriveTitle, parseMarkdown, slugify } from "../markdown/parse";
import { AccessService } from "./access.service";
import { LinkService } from "./link.service";
import { QueueService } from "./queue.service";

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().default(""),
  slug: z.string().trim().min(1).max(80).optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
  slug: z.string().trim().min(1).max(80).optional(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export class DocumentNotFoundError extends Error {
  constructor() {
    super("Document not found");
  }
}
/** Thrown when the user can see a space/document but lacks the needed role. */
export class DocumentForbiddenError extends Error {
  constructor() {
    super("You do not have permission to perform this action");
  }
}

/** Lightweight projection for list views (no full content). */
export type DocumentSummary = Pick<
  Document,
  "id" | "title" | "slug" | "updatedAt" | "createdAt" | "indexStatus"
>;

const SUMMARY_COLUMNS = {
  id: documents.id,
  title: documents.title,
  slug: documents.slug,
  updatedAt: documents.updatedAt,
  createdAt: documents.createdAt,
  indexStatus: documents.indexStatus,
} as const;

export class DocumentService {
  private readonly linkService: LinkService;
  private readonly access: AccessService;
  private readonly queue: QueueService;

  constructor(private readonly db: Database) {
    this.linkService = new LinkService(db);
    this.access = new AccessService(db);
    this.queue = new QueueService(db);
  }

  /** Create a document in a space. Requires editor+ membership in that space. */
  async create(userId: string, spaceId: string, input: CreateDocumentInput): Promise<Document> {
    const access = await this.access.resolveSpaceAccess(userId, spaceId);
    if (!access) throw new DocumentNotFoundError();
    if (!access.canWrite) throw new DocumentForbiddenError();

    const { title, content, slug } = createDocumentSchema.parse(input);
    const { frontmatter } = parseMarkdown(content);
    const resolvedTitle = title ?? deriveTitle(content, frontmatter);
    const resolvedSlug = await this.ensureUniqueSlug(spaceId, slugify(slug ?? resolvedTitle));

    const [doc] = await this.db
      .insert(documents)
      .values({ spaceId, authorId: userId, title: resolvedTitle, slug: resolvedSlug, content, frontmatter })
      .returning();
    if (!doc) throw new Error("Failed to create document");

    await this.linkService.syncOutboundLinks(doc);
    await this.linkService.resolveInboundLinks(doc);
    await this.snapshotVersion(doc, userId);
    // Embedding happens asynchronously in the worker (keeps writes fast).
    await this.queue.enqueueReindex(doc.id);
    return doc;
  }

  /** Documents in a space. Requires any membership. */
  async list(userId: string, spaceId: string, opts: { limit?: number; offset?: number } = {}): Promise<DocumentSummary[]> {
    if (!(await this.access.resolveSpaceRole(userId, spaceId))) throw new DocumentForbiddenError();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    return this.db
      .select(SUMMARY_COLUMNS)
      .from(documents)
      .where(and(eq(documents.spaceId, spaceId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  /** Returns the document if the user can read it, else undefined. */
  async get(userId: string, id: string): Promise<Document | undefined> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access?.canRead) return undefined;
    return this.getByIdUnscoped(id);
  }

  /** Reads a document without an access check — only for callers that have
   *  already authorized access (e.g. a verified public share token). Excludes
   *  trashed documents unless includeDeleted is set (trash/restore paths). */
  getByIdUnscoped(id: string, includeDeleted = false): Promise<Document | undefined> {
    return this.db.query.documents.findFirst({
      where: includeDeleted ? eq(documents.id, id) : and(eq(documents.id, id), isNull(documents.deletedAt)),
    });
  }

  async update(userId: string, id: string, input: UpdateDocumentInput): Promise<Document> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) throw new DocumentNotFoundError();
    if (!access.canWrite) throw new DocumentForbiddenError();

    const existing = await this.getByIdUnscoped(id);
    if (!existing) throw new DocumentNotFoundError();

    const { title, content, slug } = updateDocumentSchema.parse(input);
    const nextContent = content ?? existing.content;
    const { frontmatter } = parseMarkdown(nextContent);
    const nextTitle = title ?? (content !== undefined ? deriveTitle(nextContent, frontmatter) : existing.title);
    const nextSlug = slug
      ? await this.ensureUniqueSlug(existing.spaceId, slugify(slug), id)
      : existing.slug;

    const contentChanged = content !== undefined && nextContent !== existing.content;
    const [doc] = await this.db
      .update(documents)
      .set({
        title: nextTitle,
        slug: nextSlug,
        content: nextContent,
        frontmatter,
        ...(contentChanged ? { indexStatus: "pending" as const } : {}),
      })
      .where(eq(documents.id, id))
      .returning();
    if (!doc) throw new DocumentNotFoundError();

    await this.linkService.syncOutboundLinks(doc);
    if (doc.title !== existing.title || doc.slug !== existing.slug) {
      await this.linkService.resolveInboundLinks(doc);
    }
    await this.snapshotVersion(doc, userId);
    if (contentChanged) await this.queue.enqueueReindex(doc.id);
    return doc;
  }

  /** Enqueue a manual re-index for a document the user can write. */
  async requestReindex(userId: string, id: string): Promise<void> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) throw new DocumentNotFoundError();
    if (!access.canWrite) throw new DocumentForbiddenError();
    await this.db.update(documents).set({ indexStatus: "pending" }).where(eq(documents.id, id));
    await this.queue.enqueueReindex(id);
  }

  /** Documents that link to this one (within its space). */
  async backlinks(userId: string, documentId: string) {
    const access = await this.access.resolveDocumentAccess(userId, documentId);
    if (!access?.canRead) throw new DocumentForbiddenError();
    return this.linkService.backlinks(access.spaceId, documentId);
  }

  /** Soft-delete: move a document to Trash. */
  async remove(userId: string, id: string): Promise<boolean> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) return false;
    if (!access.canWrite) throw new DocumentForbiddenError();
    const updated = await this.db
      .update(documents)
      .set({ deletedAt: new Date(), deletedBy: userId })
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .returning({ id: documents.id });
    return updated.length > 0;
  }

  /** Documents in a space's Trash (editor+ only). */
  async listTrash(userId: string, spaceId: string): Promise<DocumentSummary[]> {
    const role = await this.access.resolveSpaceRole(userId, spaceId);
    if (!role) throw new DocumentForbiddenError();
    return this.db
      .select(SUMMARY_COLUMNS)
      .from(documents)
      .where(and(eq(documents.spaceId, spaceId), isNotNull(documents.deletedAt)))
      .orderBy(desc(documents.deletedAt));
  }

  /** Restore a trashed document (re-slugging if its slug was reused). */
  async restore(userId: string, id: string): Promise<Document> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) throw new DocumentNotFoundError();
    if (!access.canWrite) throw new DocumentForbiddenError();
    const doc = await this.getByIdUnscoped(id, true);
    if (!doc?.deletedAt) throw new DocumentNotFoundError();

    const slug = await this.ensureUniqueSlug(doc.spaceId, doc.slug, id);
    const [restored] = await this.db
      .update(documents)
      .set({ deletedAt: null, deletedBy: null, slug })
      .where(eq(documents.id, id))
      .returning();
    if (!restored) throw new DocumentNotFoundError();
    await this.queue.enqueueReindex(id);
    return restored;
  }

  /** Permanently delete a trashed document (cascades chunks/links/comments/versions). */
  async purgePermanently(userId: string, id: string): Promise<boolean> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) return false;
    if (!access.canWrite) throw new DocumentForbiddenError();
    const deleted = await this.db
      .delete(documents)
      .where(and(eq(documents.id, id), isNotNull(documents.deletedAt)))
      .returning({ id: documents.id });
    return deleted.length > 0;
  }

  /** Hard-delete documents trashed longer than `retentionDays`. Worker-only. */
  async purgeExpiredTrash(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const deleted = await this.db
      .delete(documents)
      .where(and(isNotNull(documents.deletedAt), lt(documents.deletedAt, cutoff)))
      .returning({ id: documents.id });
    return deleted.length;
  }

  // --- Version history -----------------------------------------------------

  /** Snapshot the current saved state, coalescing rapid same-author edits. */
  private async snapshotVersion(doc: Document, editorId: string): Promise<void> {
    const COALESCE_MS = 2 * 60 * 1000;
    const [latest] = await this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, doc.id))
      .orderBy(desc(documentVersions.version))
      .limit(1);

    const coalesce =
      latest && latest.authorId === editorId && Date.now() - latest.createdAt.getTime() < COALESCE_MS;
    if (coalesce) {
      await this.db
        .update(documentVersions)
        .set({ title: doc.title, content: doc.content, frontmatter: doc.frontmatter, createdAt: new Date() })
        .where(eq(documentVersions.id, latest.id));
    } else {
      await this.db.insert(documentVersions).values({
        documentId: doc.id,
        version: (latest?.version ?? 0) + 1,
        title: doc.title,
        content: doc.content,
        frontmatter: doc.frontmatter,
        authorId: editorId,
      });
    }
  }

  /** Version history (newest first), without content payloads. */
  async listVersions(userId: string, id: string): Promise<Omit<DocumentVersion, "content" | "frontmatter">[]> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access?.canRead) throw new DocumentForbiddenError();
    return this.db
      .select({
        id: documentVersions.id,
        documentId: documentVersions.documentId,
        version: documentVersions.version,
        title: documentVersions.title,
        authorId: documentVersions.authorId,
        createdAt: documentVersions.createdAt,
      })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, id))
      .orderBy(desc(documentVersions.version));
  }

  /** Restore a document to a prior version (creates a new version). */
  async restoreVersion(userId: string, id: string, version: number): Promise<Document> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) throw new DocumentNotFoundError();
    if (!access.canWrite) throw new DocumentForbiddenError();
    const [snapshot] = await this.db
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.documentId, id), eq(documentVersions.version, version)))
      .limit(1);
    if (!snapshot) throw new DocumentNotFoundError();
    return this.update(userId, id, { title: snapshot.title, content: snapshot.content });
  }

  /** Appends -2, -3, … until the slug is unique within the space. */
  private async ensureUniqueSlug(spaceId: string, desired: string, excludeId?: string): Promise<string> {
    const taken = await this.db
      .select({ slug: documents.slug })
      .from(documents)
      .where(
        and(
          eq(documents.spaceId, spaceId),
          isNull(documents.deletedAt),
          like(documents.slug, `${desired}%`),
          excludeId ? ne(documents.id, excludeId) : undefined,
        ),
      );
    const set = new Set(taken.map((r) => r.slug));
    if (!set.has(desired)) return desired;
    for (let i = 2; ; i++) {
      const candidate = `${desired}-${i}`;
      if (!set.has(candidate)) return candidate;
    }
  }
}
