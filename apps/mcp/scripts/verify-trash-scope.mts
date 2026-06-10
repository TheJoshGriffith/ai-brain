/** Verifies trash MCP tools: list_trash / restore_document / purge_document + purge scope. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, documents, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentService, SpaceService, TokenService } from "@ai-brain/core";
import { authenticate, requireScope } from "../src/context.js";

const db = getDb();
let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "tr";
const email = `mcptrash_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await new AuthService(db).register({ email, password: "password123" });
const space = await new SpaceService(db).create(user.id, { name: `Trash ${stamp}` });
const docs = new DocumentService(db);
const tokens = new TokenService(db);
const ctxFor = async (scopes: string[]) => (await authenticate((await tokens.create(user.id, { name: scopes.join(","), scopes })).token))!;

// Soft-delete a doc, then it should appear in list_trash (documents:read).
const doc = await docs.create(user.id, space.id, { title: "Recyclable", content: "# r\n" });
await docs.remove(user.id, doc.id);
const reader = await ctxFor(["documents:read"]);
const trash = await reader.documents.listTrash(reader.userId, space.id);
check("list_trash shows the soft-deleted document", trash.some((d) => d.id === doc.id));

// Restore it (documents:write) → back in the normal list, out of trash.
const writer = await ctxFor(["documents:write"]);
await writer.documents.restore(writer.userId, doc.id);
const live = await docs.list(user.id, space.id);
check("restore_document brings it back into the space", live.some((d) => d.id === doc.id));

// Trash again; a delete-scoped token may NOT purge.
await docs.remove(user.id, doc.id);
const deleter = await ctxFor(["documents:delete"]);
let denied = false;
try { requireScope(deleter, "documents:purge"); } catch { denied = true; }
check("documents:delete alone is denied documents:purge", denied);

// A purge-scoped token permanently removes it.
const purger = await ctxFor(["documents:purge"]);
requireScope(purger, "documents:purge");
const purged = await purger.documents.purgePermanently(purger.userId, doc.id);
check("purge_document permanently deletes the document", purged === true);
const row = await db.query.documents.findFirst({ where: eq(documents.id, doc.id) });
check("the row is gone for good (not just trashed)", row === undefined);

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
