import { config } from "../config";
import { LocalEmbeddingProvider } from "./local";
import { OpenAIEmbeddingProvider, VoyageEmbeddingProvider } from "./hosted";
import type { EmbeddingProvider } from "./types";

export type { EmbeddingProvider } from "./types";
export { LocalEmbeddingProvider } from "./local";
export { VoyageEmbeddingProvider, OpenAIEmbeddingProvider } from "./hosted";

let singleton: EmbeddingProvider | null = null;

/** Returns the configured embedding provider (singleton). */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (singleton) return singleton;
  switch (config.embeddingProvider) {
    case "voyage": {
      if (!config.voyageApiKey) throw new Error("VOYAGE_API_KEY is required for the voyage provider");
      singleton = new VoyageEmbeddingProvider(config.voyageApiKey);
      break;
    }
    case "openai": {
      if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required for the openai provider");
      singleton = new OpenAIEmbeddingProvider(config.openaiApiKey);
      break;
    }
    default:
      singleton = new LocalEmbeddingProvider(config.embeddingModel);
  }
  return singleton;
}
