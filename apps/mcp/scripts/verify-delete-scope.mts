/** Verifies documents:delete is required to delete (and write alone is not enough). */
import { eq, inArray, isNotNull } from "drizzle-orm";
import { closeDb, documents, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentService, SpaceService, TokenService } from "@ai-brain/core";
import { authenticate, requireScope } from "../src/context.js";

const db = getDb();
let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "del";
const email = `mcpdel_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await new AuthService(db).register({ email, password: "password123" });
const space = await new SpaceService(db).create(user.id, { name: `Del ${stamp}` });
const docs = new DocumentService(db);
const tokens = new TokenService(db);

// A writer (no delete scope) must NOT be able to delete.
const writer = (await authenticate((await tokens.create(user.id, { name: "w", scopes: ["documents:write"] })).token))!;
let denied = false;
try { requireScope(writer, "documents:delete"); } catch { denied = true; }
check("documents:write alone is denied documents:delete", denied);

// A delete-scoped token can soft-delete (move to trash).
const del = (await authenticate((await tokens.create(user.id, { name: "d", scopes: ["documents:delete"] })).token))!;
requireScope(del, "documents:delete");
const doc = await docs.create(user.id, space.id, { title: "Doomed", content: "# Doomed\n" });
const removed = await del.documents.remove(del.userId, doc.id);
check("documents:delete token removes the document", removed === true);

const live = await docs.list(user.id, space.id);
check("document no longer appears in the normal list", !live.some((d) => d.id === doc.id));
const trashed = await db.query.documents.findFirst({ where: isNotNull(documents.deletedAt) });
check("document is soft-deleted (in trash, not purged)", Boolean(trashed));

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
