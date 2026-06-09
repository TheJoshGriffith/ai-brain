export interface EmbeddingProvider {
  /** Output vector dimension; must match the document_chunks.embedding column. */
  readonly dimensions: number;
  /** Embeds a batch of texts, returning one vector per input. */
  embed(texts: string[]): Promise<number[][]>;
}
