/** Unit 2 verification: version history (coalesced), soft-delete/trash, restore, purge. */
import { eq, inArray, sql } from "drizzle-orm";
import { closeDb, documentVersions, documents, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentService, SearchService, SpaceService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const docs = new DocumentService(db);
const search = new SearchService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };
const versionCount = (id: string) =>
  db.select({ n: sql<number>`count(*)::int` }).from(documentVersions).where(eq(documentVersions.documentId, id)).then((r) => r[0]?.n ?? 0);

const stamp = process.argv[2] ?? "v";
const email = `ver_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await auth.register({ email, password: "password123" });
const space = await new SpaceService(db).create(user.id, { name: `Versions ${stamp}` });

// Create → v1; immediate edit coalesces into v1.
const doc = await docs.create(user.id, space.id, { title: "Note", content: "# Note\n\nAlpha.\n" });
check("create writes version 1", (await versionCount(doc.id)) === 1);
await docs.update(user.id, doc.id, { content: "# Note\n\nBeta.\n" });
check("rapid same-author edit coalesces (still 1 version)", (await versionCount(doc.id)) === 1);

// Backdate the latest version past the coalesce window → next edit makes v2.
await db.execute(sql`update document_versions set created_at = now() - interval '3 minutes' where document_id = ${doc.id}`);
await docs.update(user.id, doc.id, { content: "# Note\n\nGamma.\n" });
check("edit after the window creates version 2", (await versionCount(doc.id)) === 2);

const versions = await docs.listVersions(user.id, doc.id);
check("history lists newest first", versions[0]!.version === 2 && versions[1]!.version === 1);

// Restore v1 (content "Beta") → current content changes back.
await docs.restoreVersion(user.id, doc.id, 1);
check("restore version 1 brings back its content", (await docs.getByIdUnscoped(doc.id))!.content.includes("Beta"));

// Soft delete hides from reads; trash shows it.
await docs.remove(user.id, doc.id);
check("removed doc is hidden from get()", (await docs.get(user.id, doc.id)) === undefined);
check("removed doc is absent from list()", !(await docs.list(user.id, space.id)).some((d) => d.id === doc.id));
check("removed doc is absent from search", !(await search.search(user.id, space.id, "Beta")).some((r) => r.documentId === doc.id));
check("removed doc appears in trash", (await docs.listTrash(user.id, space.id)).some((d) => d.id === doc.id));

// Restore from trash.
await docs.restore(user.id, doc.id);
check("restore from trash makes it readable again", Boolean(await docs.get(user.id, doc.id)));

// A new doc can take the slug while one is trashed (partial unique index).
await docs.remove(user.id, doc.id);
const reuse = await docs.create(user.id, space.id, { title: "Note", content: "# Note\n" });
check("slug reused while original is trashed", reuse.slug === "note");

// Retention purge.
await db.execute(sql`update documents set deleted_at = now() - interval '31 days' where id = ${doc.id}`);
const purged = await docs.purgeExpiredTrash(30);
check("retention purge hard-deletes expired trash", purged >= 1);
check("purged doc is gone", (await db.select().from(documents).where(eq(documents.id, doc.id))).length === 0);
check("its versions cascade away", (await versionCount(doc.id)) === 0);

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
