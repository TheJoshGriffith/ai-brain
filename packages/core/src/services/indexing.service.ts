import { eq } from "drizzle-orm";
import { documentChunks, type Database } from "@ai-brain/db";
import { getEmbeddingProvider, type EmbeddingProvider } from "../embeddings";
import { chunkContent } from "../search/chunk";

/**
 * Keeps document_chunks (and their embeddings) in sync with a document's
 * content. Embedding failures are non-fatal: the chunks are cleared and the
 * write proceeds, so full-text search keeps working even if the embedding
 * backend is unavailable.
 */
export class IndexingService {
  constructor(
    private readonly db: Database,
    private readonly provider: EmbeddingProvider = getEmbeddingProvider(),
  ) {}

  async reindex(doc: { id: string; content: string }): Promise<void> {
    await this.db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id));

    const chunks = chunkContent(doc.content);
    if (chunks.length === 0) return;

    let vectors: number[][];
    try {
      vectors = await this.provider.embed(chunks);
    } catch (error) {
      console.warn(`[indexing] embedding failed for document ${doc.id}:`, error);
      return; // FTS still works; semantic results just won't include this doc.
    }

    await this.db.insert(documentChunks).values(
      chunks.map((content, i) => ({
        documentId: doc.id,
        chunkIndex: i,
        content,
        embedding: vectors[i],
      })),
    );
  }
}
