/**
 * Seed/create a user. Usage:
 *   node --import tsx scripts/create-user.mts <email> <password> [name]
 */
import { AuthService } from "@ai-brain/core";
import { closeDb, getDb } from "@ai-brain/db";

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: create-user.mts <email> <password> [name]");
  process.exit(1);
}

const user = await new AuthService(getDb()).register({ email, password, name });
console.log(`Created user ${user.email} (${user.id})`);
await closeDb();
