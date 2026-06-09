import type { EmbeddingProvider } from "./types";

/**
 * In-process embeddings via transformers.js (ONNX). No API key, no network
 * after the first model download (cached under node_modules/@xenova). The model
 * is loaded lazily on first use so importing this module is cheap.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 384;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipe: Promise<any> | null = null;

  constructor(private readonly model = "Xenova/bge-small-en-v1.5") {}

  private getPipe() {
    if (!this.pipe) {
      this.pipe = import("@xenova/transformers").then(({ pipeline }) =>
        pipeline("feature-extraction", this.model),
      );
    }
    return this.pipe;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const pipe = await this.getPipe();
    const vectors: number[][] = [];
    for (const text of texts) {
      const output = await pipe(text, { pooling: "mean", normalize: true });
      vectors.push(Array.from(output.data as Float32Array));
    }
    return vectors;
  }
}
