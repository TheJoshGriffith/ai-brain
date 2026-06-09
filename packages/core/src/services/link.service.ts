import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { documents, links, type Database } from "@ai-brain/db";
import { extractWikiLinks, slugify } from "../markdown/parse";

export interface BacklinkRef {
  documentId: string;
  title: string;
  slug: string;
}

export interface OutboundLink {
  targetRaw: string;
  targetDocumentId: string | null;
  resolved: boolean;
}

/** Minimal shape needed to (re)compute links for a document. */
interface DocRef {
  id: string;
  spaceId: string;
  title: string;
  slug: string;
  content: string;
}

export class LinkService {
  constructor(private readonly db: Database) {}

  /**
   * Recomputes a document's outbound links from its content: clears existing
   * links, then inserts one row per unique wiki-link, resolving each target to
   * a document in the same space (by slug, then title) where possible.
   */
  async syncOutboundLinks(doc: DocRef): Promise<void> {
    const wikiLinks = extractWikiLinks(doc.content);

    await this.db.transaction(async (tx) => {
      await tx.delete(links).where(eq(links.sourceDocumentId, doc.id));
      if (wikiLinks.length === 0) return;

      const targets = wikiLinks.map((l) => l.target);
      const slugs = targets.map(slugify);
      // Resolve all candidate targets within this space in one query.
      const candidates = await tx
        .select({ id: documents.id, title: documents.title, slug: documents.slug })
        .from(documents)
        .where(and(eq(documents.spaceId, doc.spaceId), isNull(documents.deletedAt)));

      const bySlug = new Map(candidates.map((c) => [c.slug, c.id]));
      const byTitle = new Map(candidates.map((c) => [c.title.toLowerCase(), c.id]));

      await tx.insert(links).values(
        wikiLinks.map((l, i) => {
          const targetId =
            bySlug.get(slugs[i] ?? "") ?? byTitle.get(l.target.toLowerCase()) ?? null;
          return {
            sourceDocumentId: doc.id,
            targetDocumentId: targetId === doc.id ? null : targetId, // ignore self-links
            targetRaw: l.target,
          };
        }),
      );
    });
  }

  /**
   * Resolves previously-unresolved inbound links that point at this document
   * (e.g. after it is created or its title/slug changes).
   */
  async resolveInboundLinks(doc: DocRef): Promise<number> {
    // Unresolved links in the same space whose raw target matches by slug or title.
    const unresolved = await this.db
      .select({ id: links.id, targetRaw: links.targetRaw })
      .from(links)
      .innerJoin(documents, eq(links.sourceDocumentId, documents.id))
      .where(and(isNull(links.targetDocumentId), eq(documents.spaceId, doc.spaceId)));

    const matches = unresolved.filter(
      (l) => slugify(l.targetRaw) === doc.slug || l.targetRaw.toLowerCase() === doc.title.toLowerCase(),
    );
    if (matches.length === 0) return 0;

    await this.db
      .update(links)
      .set({ targetDocumentId: doc.id })
      .where(inArray(links.id, matches.map((m) => m.id)));
    return matches.length;
  }

  /** Documents that link TO the given document (within its space). */
  backlinks(spaceId: string, documentId: string): Promise<BacklinkRef[]> {
    return this.db
      .selectDistinct({
        documentId: documents.id,
        title: documents.title,
        slug: documents.slug,
      })
      .from(links)
      .innerJoin(documents, eq(links.sourceDocumentId, documents.id))
      .where(and(eq(links.targetDocumentId, documentId), eq(documents.spaceId, spaceId), isNull(documents.deletedAt)));
  }

  /** A document's outbound links (resolved and unresolved). */
  async outboundLinks(documentId: string): Promise<OutboundLink[]> {
    const rows = await this.db
      .select({ targetRaw: links.targetRaw, targetDocumentId: links.targetDocumentId })
      .from(links)
      .where(eq(links.sourceDocumentId, documentId));
    return rows.map((r) => ({ ...r, resolved: r.targetDocumentId !== null }));
  }

  /**
   * Resolves a raw wiki-link target to a document id within a space, by slug
   * then title. Used by the link resolver route.
   */
  async resolveTarget(spaceId: string, raw: string): Promise<string | null> {
    const slug = slugify(raw);
    const row = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.spaceId, spaceId),
          isNull(documents.deletedAt),
          sql`(${documents.slug} = ${slug} or lower(${documents.title}) = ${raw.toLowerCase()})`,
        ),
      )
      .limit(1);
    return row[0]?.id ?? null;
  }
}
