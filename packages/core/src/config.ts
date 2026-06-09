/** Centralised, validated access to environment configuration. */

export type EmbeddingProviderName = "local" | "voyage" | "openai";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get embeddingProvider(): EmbeddingProviderName {
    return (process.env.EMBEDDING_PROVIDER as EmbeddingProviderName) || "local";
  },
  get embeddingModel(): string {
    return process.env.EMBEDDING_MODEL || "Xenova/bge-small-en-v1.5";
  },
  get voyageApiKey(): string | undefined {
    return process.env.VOYAGE_API_KEY || undefined;
  },
  get openaiApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY || undefined;
  },
};
