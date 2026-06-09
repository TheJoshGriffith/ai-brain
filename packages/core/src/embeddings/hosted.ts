import type { EmbeddingProvider } from "./types";

/** Voyage AI embeddings (Anthropic's recommended partner). Requires an API key. */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  constructor(
    private readonly apiKey: string,
    private readonly model = "voyage-3-lite",
    dimensions = 512,
  ) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

/** OpenAI embeddings (text-embedding-3-*). Requires an API key. */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    dimensions = 1536,
  ) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}
