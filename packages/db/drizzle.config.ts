import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run drizzle-kit");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  // pgvector / tsvector are created via the SQL in migrations/0000_init_extensions.sql.
  verbose: true,
  strict: true,
});
