/** Feature 1 verification: optimistic concurrency on document writes. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentConflictError, DocumentService, SpaceService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const docs = new DocumentService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "cc";
const email = `conc_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await auth.register({ email, password: "password123" });
const space = await new SpaceService(db).create(user.id, { name: `Conc ${stamp}` });

const doc = await docs.create(user.id, space.id, { title: "Race", content: "v0\n" });
check("new doc starts at revision 0", doc.revision === 0);

const r1 = await docs.update(user.id, doc.id, { content: "v1\n", expectedRevision: 0 });
check("matching expectedRevision succeeds and bumps revision", r1.revision === 1);

// Simulate a stale client (still thinks it's at revision 0).
let conflictRev = -1;
const conflicted = await docs
  .update(user.id, doc.id, { content: "stale write\n", expectedRevision: 0 })
  .then(() => false)
  .catch((e) => { if (e instanceof DocumentConflictError) { conflictRev = e.currentRevision; return true; } return false; });
check("stale expectedRevision is rejected with a conflict", conflicted);
check("conflict reports the current revision", conflictRev === 1);
check("the stale write did not land", (await docs.getByIdUnscoped(doc.id))!.content.includes("v1"));

// No expectedRevision → last-write-wins (e.g. an agent that didn't read first).
const r2 = await docs.update(user.id, doc.id, { content: "agent write\n" });
check("omitting expectedRevision still writes (LWW) and bumps revision", r2.revision === 2 && r2.content.includes("agent write"));

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
