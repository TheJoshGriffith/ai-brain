/** Sub-phase B verification: space-scoped tags, normalization, filtering, access. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentForbiddenError, DocumentService, SpaceService, TagService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const spaceSvc = new SpaceService(db);
const docs = new DocumentService(db);
const tagsSvc = new TagService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };
const denied = (fn: () => Promise<unknown>) => fn().then(() => false).catch((e) => e instanceof DocumentForbiddenError);

const stamp = process.argv[2] ?? "tag";
const emails = [`ta_${stamp}@example.com`, `tb_${stamp}@example.com`];
await db.delete(users).where(inArray(users.email, emails));
const A = await auth.register({ email: emails[0]!, password: "password123" });
const B = await auth.register({ email: emails[1]!, password: "password123" });
const space = await spaceSvc.create(A.id, { name: `Tagged ${stamp}` });
const doc1 = await docs.create(A.id, space.id, { title: "Doc one", content: "# Doc one\n" });
const doc2 = await docs.create(A.id, space.id, { title: "Doc two", content: "# Doc two\n" });

const set = await tagsSvc.setDocumentTags(A.id, doc1.id, ["Project Alpha", "todo", "TODO", "  "]);
check("tags normalized + deduped", JSON.stringify(set) === JSON.stringify(["project alpha", "todo"]));
check("getDocumentTags reflects the set", JSON.stringify(await tagsSvc.getDocumentTags(doc1.id)) === JSON.stringify(["project alpha", "todo"]));

await tagsSvc.setDocumentTags(A.id, doc2.id, ["todo"]);
check("space has 2 distinct tags", (await tagsSvc.listForSpace(A.id, space.id)).length === 2);
check("filter by 'todo' → 2 docs", (await tagsSvc.listDocumentsByTag(A.id, space.id, "todo")).length === 2);
check("filter by 'project alpha' → 1 doc", (await tagsSvc.listDocumentsByTag(A.id, space.id, "Project Alpha")).length === 1);

// Viewer cannot tag.
await spaceSvc.addMember(A.id, space.id, { email: B.email, role: "viewer" });
check("viewer cannot set tags", await denied(() => tagsSvc.setDocumentTags(B.id, doc1.id, ["x"])));
check("non-member cannot list space tags", await denied(() => tagsSvc.listForSpace("nobody", space.id)));

// Replace with empty clears.
await tagsSvc.setDocumentTags(A.id, doc1.id, []);
check("clearing tags works", (await tagsSvc.getDocumentTags(doc1.id)).length === 0);

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(inArray(users.id, [A.id, B.id]));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
