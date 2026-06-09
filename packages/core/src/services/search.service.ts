import { sql } from "drizzle-orm";
import type { Database } from "@ai-brain/db";
import { getEmbeddingProvider, type EmbeddingProvider } from "../embeddings";
import { AccessService } from "./access.service";

export interface SearchResult {
  documentId: string;
  title: string;
  slug: string;
  snippet: string | null;
  score: number;
  /** Which retrievers surfaced this result. */
  matched: ("fulltext" | "semantic")[];
}

interface Ranked {
  documentId: string;
  title: string;
  slug: string;
  snippet: string | null;
}

const RRF_K = 60;

export class SearchService {
  private readonly access: AccessService;
  constructor(
    private readonly db: Database,
    private readonly provider: EmbeddingProvider = getEmbeddingProvider(),
  ) {
    this.access = new AccessService(db);
  }

  /**
   * Hybrid search within a space: Postgres full-text + pgvector semantic
   * similarity, merged with Reciprocal Rank Fusion. Falls back to full-text
   * alone if embedding the query fails. Requires space membership.
   */
  async search(
    userId: string,
    spaceId: string,
    query: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<SearchResult[]> {
    if (!(await this.access.resolveSpaceRole(userId, spaceId))) return [];
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
    const offset = Math.max(opts.offset ?? 0, 0);
    if (!query.trim()) return [];
    // Retrieve a deep enough pool to fuse + paginate.
    const pool = Math.min((offset + limit) * 3, 300);

    const fts = await this.fullTextSearch(spaceId, query, pool);

    let semantic: Ranked[] = [];
    try {
      const [vector] = await this.provider.embed([query]);
      if (vector) semantic = await this.semanticSearch(spaceId, vector, pool);
    } catch (error) {
      console.warn("[search] semantic search unavailable, using full-text only:", error);
    }

    return this.fuse(fts, semantic, offset + limit).slice(offset);
  }

  private async fullTextSearch(spaceId: string, query: string, limit: number): Promise<Ranked[]> {
    const { rows } = await this.db.execute(sql`
      select
        id as "documentId",
        title,
        slug,
        ts_headline('english', content, websearch_to_tsquery('english', ${query}),
          'MaxFragments=1,MaxWords=24,MinWords=8,StartSel=<<,StopSel=>>') as snippet
      from documents
      where space_id = ${spaceId}
        and deleted_at is null
        and content_tsv @@ websearch_to_tsquery('english', ${query})
      order by ts_rank_cd(content_tsv, websearch_to_tsquery('english', ${query})) desc
      limit ${limit}
    `);
    return rows as unknown as Ranked[];
  }

  private async semanticSearch(spaceId: string, vector: number[], limit: number): Promise<Ranked[]> {
    const literal = `[${vector.join(",")}]`;
    const { rows } = await this.db.execute(sql`
      select d.id as "documentId", d.title, d.slug, null as snippet
      from document_chunks c
      join documents d on d.id = c.document_id
      where d.space_id = ${spaceId} and d.deleted_at is null
      group by d.id, d.title, d.slug
      order by min(c.embedding <=> ${literal}::vector) asc
      limit ${limit}
    `);
    return rows as unknown as Ranked[];
  }

  /** Reciprocal Rank Fusion of the two ranked lists. */
  private fuse(fts: Ranked[], semantic: Ranked[], limit: number): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    const add = (list: Ranked[], source: "fulltext" | "semantic") => {
      list.forEach((row, index) => {
        const contribution = 1 / (RRF_K + index + 1);
        const existing = merged.get(row.documentId);
        if (existing) {
          existing.score += contribution;
          if (!existing.matched.includes(source)) existing.matched.push(source);
          if (!existing.snippet && row.snippet) existing.snippet = row.snippet;
        } else {
          merged.set(row.documentId, {
            documentId: row.documentId,
            title: row.title,
            slug: row.slug,
            snippet: row.snippet,
            score: contribution,
            matched: [source],
          });
        }
      });
    };

    add(fts, "fulltext");
    add(semantic, "semantic");

    return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
