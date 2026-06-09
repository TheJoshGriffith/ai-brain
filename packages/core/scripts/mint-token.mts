/**
 * Mint a PAT for an existing user. Usage:
 *   node --import tsx scripts/mint-token.mts <email> [scopesCsv]
 * Prints the raw token to stdout.
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb, users } from "@ai-brain/db";
import { TokenService } from "@ai-brain/core";

const [email, scopesCsv] = process.argv.slice(2);
if (!email) {
  console.error("Usage: mint-token.mts <email> [scopesCsv]");
  process.exit(1);
}
const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, email) });
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}
const scopes = (scopesCsv ?? "documents:read,documents:write,search:read").split(",");
const { token } = await new TokenService(db).create(user.id, {
  name: "cli",
  scopes: scopes as never,
});
console.log(token);
await closeDb();
