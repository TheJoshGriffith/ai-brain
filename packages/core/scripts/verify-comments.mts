/** Sub-phase D verification: comments gated by the commenter role. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, CommentService, DocumentForbiddenError, DocumentService, SpaceService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const spaceSvc = new SpaceService(db);
const docs = new DocumentService(db);
const commentSvc = new CommentService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };
const denied = (fn: () => Promise<unknown>) => fn().then(() => false).catch((e) => e instanceof DocumentForbiddenError);

const stamp = process.argv[2] ?? "cm";
const emails = ["a", "b", "c"].map((x) => `${x}_${stamp}@example.com`);
await db.delete(users).where(inArray(users.email, emails));
const [A, B, C] = await Promise.all(emails.map((email) => auth.register({ email, password: "password123" })));
const space = await spaceSvc.create(A!.id, { name: `Comments ${stamp}` });
const doc = await docs.create(A!.id, space.id, { title: "Reviewable", content: "# Reviewable\n" });

await spaceSvc.addMember(A!.id, space.id, { email: B!.email, role: "viewer" });
await spaceSvc.addMember(A!.id, space.id, { email: C!.email, role: "commenter" });

check("viewer cannot comment", await denied(() => commentSvc.add(B!.id, doc.id, { body: "nope" })));
const c1 = await commentSvc.add(C!.id, doc.id, { body: "Looks good to me" });
check("commenter can comment", Boolean(c1.id) && c1.authorEmail === C!.email);
const c2 = await commentSvc.add(A!.id, doc.id, { body: "Thanks!" });
check("owner can comment", Boolean(c2.id));

const list = await commentSvc.list(B!.id, doc.id);
check("viewer can read comments", list.length === 2);

check("non-author viewer cannot delete others' comments", await denied(() => commentSvc.remove(B!.id, c1.id)));
check("author can delete own comment", await commentSvc.remove(C!.id, c1.id));
check("space owner can moderate others' comments", await commentSvc.remove(A!.id, c2.id));
check("comments now empty", (await commentSvc.list(A!.id, doc.id)).length === 0);

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(inArray(users.id, [A!.id, B!.id, C!.id]));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
