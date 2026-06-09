import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Database | undefined;

/**
 * Returns a singleton Drizzle client. Lazily initialised so importing this
 * module never throws before DATABASE_URL is needed (e.g. during build).
 */
export function getDb(): Database {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
