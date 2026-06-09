import { and, desc, eq, like, ne } from "drizzle-orm";
import { documents, type Database, type Document } from "@ai-brain/db";
import { z } from "zod";
import { deriveTitle, parseMarkdown, slugify } from "../markdown/parse";
import { AccessService } from "./access.service";
import { LinkService } from "./link.service";
import { IndexingService } from "./indexing.service";

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
  "id" | "title" | "slug" | "updatedAt" | "createdAt"
>;

const SUMMARY_COLUMNS = {
  id: documents.id,
  title: documents.title,
  slug: documents.slug,
  updatedAt: documents.updatedAt,
  createdAt: documents.createdAt,
} as const;

export class DocumentService {
  private readonly linkService: LinkService;
  private readonly access: AccessService;
  private indexer: IndexingService | null = null;

  constructor(private readonly db: Database) {
    this.linkService = new LinkService(db);
    this.access = new AccessService(db);
  }

  /** Lazily constructed so misconfigured embedding providers don't break CRUD. */
  private getIndexer(): IndexingService {
    if (!this.indexer) this.indexer = new IndexingService(this.db);
    return this.indexer;
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
    await this.getIndexer().reindex(doc);
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
      .where(eq(documents.spaceId, spaceId))
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
   *  already authorized access (e.g. a verified public share token). */
  getByIdUnscoped(id: string): Promise<Document | undefined> {
    return this.db.query.documents.findFirst({ where: eq(documents.id, id) });
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

    const [doc] = await this.db
      .update(documents)
      .set({ title: nextTitle, slug: nextSlug, content: nextContent, frontmatter })
      .where(eq(documents.id, id))
      .returning();
    if (!doc) throw new DocumentNotFoundError();

    await this.linkService.syncOutboundLinks(doc);
    if (doc.title !== existing.title || doc.slug !== existing.slug) {
      await this.linkService.resolveInboundLinks(doc);
    }
    if (content !== undefined) await this.getIndexer().reindex(doc);
    return doc;
  }

  /** Documents that link to this one (within its space). */
  async backlinks(userId: string, documentId: string) {
    const access = await this.access.resolveDocumentAccess(userId, documentId);
    if (!access?.canRead) throw new DocumentForbiddenError();
    return this.linkService.backlinks(access.spaceId, documentId);
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access) return false;
    if (!access.canWrite) throw new DocumentForbiddenError();
    const deleted = await this.db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    return deleted.length > 0;
  }

  /** Appends -2, -3, … until the slug is unique within the space. */
  private async ensureUniqueSlug(spaceId: string, desired: string, excludeId?: string): Promise<string> {
    const taken = await this.db
      .select({ slug: documents.slug })
      .from(documents)
      .where(
        and(
          eq(documents.spaceId, spaceId),
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
