import { eq } from "drizzle-orm";
import { documentChunks, documents, type Database } from "@ai-brain/db";
import { getEmbeddingProvider, type EmbeddingProvider } from "../embeddings";
import { chunkContent } from "../search/chunk";

/**
 * Rebuilds a document's chunk embeddings and stamps its index_status. Run by the
 * background worker. Embedding failures mark the doc `failed` (and surface in the
 * UI badge) while leaving full-text search intact.
 */
export class IndexingService {
  constructor(
    private readonly db: Database,
    private readonly provider: EmbeddingProvider = getEmbeddingProvider(),
  ) {}

  /** Re-embed a document by id, reading its current content from the DB. */
  async reindexById(documentId: string): Promise<void> {
    const doc = await this.db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    if (!doc) return; // deleted before the job ran
    await this.reindex({ id: doc.id, content: doc.content });
  }

  async reindex(doc: { id: string; content: string }): Promise<void> {
    await this.db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id));

    const chunks = chunkContent(doc.content);
    if (chunks.length > 0) {
      let vectors: number[][];
      try {
        vectors = await this.provider.embed(chunks);
      } catch (error) {
        await this.stamp(doc.id, "failed");
        throw error; // let the queue retry with backoff
      }
      await this.db.insert(documentChunks).values(
        chunks.map((content, i) => ({ documentId: doc.id, chunkIndex: i, content, embedding: vectors[i] })),
      );
    }
    await this.stamp(doc.id, "indexed");
  }

  private async stamp(documentId: string, status: "indexed" | "failed"): Promise<void> {
    await this.db
      .update(documents)
      .set({ indexStatus: status, indexedAt: status === "indexed" ? new Date() : null })
      .where(eq(documents.id, documentId));
  }
}
