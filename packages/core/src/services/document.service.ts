import { and, desc, eq, like, ne } from "drizzle-orm";
import { documents, type Database, type Document } from "@ai-brain/db";
import { z } from "zod";
import { deriveTitle, parseMarkdown, slugify } from "../markdown/parse";
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
  private indexer: IndexingService | null = null;

  constructor(private readonly db: Database) {
    this.linkService = new LinkService(db);
  }

  /** Lazily constructed so misconfigured embedding providers don't break CRUD. */
  private getIndexer(): IndexingService {
    if (!this.indexer) this.indexer = new IndexingService(this.db);
    return this.indexer;
  }

  async create(ownerId: string, input: CreateDocumentInput): Promise<Document> {
    const { title, content, slug } = createDocumentSchema.parse(input);
    const { frontmatter } = parseMarkdown(content);
    const resolvedTitle = title ?? deriveTitle(content, frontmatter);
    const resolvedSlug = await this.ensureUniqueSlug(
      ownerId,
      slugify(slug ?? resolvedTitle),
    );

    const [doc] = await this.db
      .insert(documents)
      .values({
        ownerId,
        title: resolvedTitle,
        slug: resolvedSlug,
        content,
        frontmatter,
      })
      .returning();
    if (!doc) throw new Error("Failed to create document");

    // Index this doc's outbound links, and resolve any existing links that were
    // waiting for a document with this title/slug to exist.
    await this.linkService.syncOutboundLinks(doc);
    await this.linkService.resolveInboundLinks(doc);
    await this.getIndexer().reindex(doc);
    return doc;
  }

  list(ownerId: string, opts: { limit?: number; offset?: number } = {}): Promise<DocumentSummary[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    return this.db
      .select(SUMMARY_COLUMNS)
      .from(documents)
      .where(eq(documents.ownerId, ownerId))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  get(ownerId: string, id: string): Promise<Document | undefined> {
    return this.db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.ownerId, ownerId)),
    });
  }

  getBySlug(ownerId: string, slug: string): Promise<Document | undefined> {
    return this.db.query.documents.findFirst({
      where: and(eq(documents.slug, slug), eq(documents.ownerId, ownerId)),
    });
  }

  async update(ownerId: string, id: string, input: UpdateDocumentInput): Promise<Document> {
    const { title, content, slug } = updateDocumentSchema.parse(input);
    const existing = await this.get(ownerId, id);
    if (!existing) throw new DocumentNotFoundError();

    const nextContent = content ?? existing.content;
    const { frontmatter } = parseMarkdown(nextContent);
    const nextTitle = title ?? (content !== undefined ? deriveTitle(nextContent, frontmatter) : existing.title);
    const nextSlug = slug
      ? await this.ensureUniqueSlug(ownerId, slugify(slug), id)
      : existing.slug;

    const [doc] = await this.db
      .update(documents)
      .set({ title: nextTitle, slug: nextSlug, content: nextContent, frontmatter })
      .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
      .returning();
    if (!doc) throw new DocumentNotFoundError();

    await this.linkService.syncOutboundLinks(doc);
    // Title/slug may have changed — re-resolve inbound links that now match.
    if (doc.title !== existing.title || doc.slug !== existing.slug) {
      await this.linkService.resolveInboundLinks(doc);
    }
    if (content !== undefined) await this.getIndexer().reindex(doc);
    return doc;
  }

  /** Documents that link to this one. */
  backlinks(ownerId: string, documentId: string) {
    return this.linkService.backlinks(ownerId, documentId);
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
      .returning({ id: documents.id });
    return deleted.length > 0;
  }

  /** Appends -2, -3, … until the slug is unique for this owner. */
  private async ensureUniqueSlug(
    ownerId: string,
    desired: string,
    excludeId?: string,
  ): Promise<string> {
    const taken = await this.db
      .select({ slug: documents.slug })
      .from(documents)
      .where(
        and(
          eq(documents.ownerId, ownerId),
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
