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
  get trashRetentionDays(): number {
    return Number(process.env.TRASH_RETENTION_DAYS ?? 30);
  },
  get appUrl(): string {
    return process.env.AUTH_URL || "http://localhost:3002";
  },
  get requireEmailVerification(): boolean {
    return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
  },
  get smtp(): { host: string; port: number; secure: boolean; user?: string; pass?: string } | null {
    if (!process.env.SMTP_HOST) return null;
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
    };
  },
  get emailFrom(): string {
    return process.env.EMAIL_FROM || "AI Brain <no-reply@ai-brain.local>";
  },
};
