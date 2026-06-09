/** Feature 4 verification: server-side pagination + sort for document lists. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentService, SpaceService, TagService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const docs = new DocumentService(db);
const tags = new TagService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "pg";
const email = `page_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await auth.register({ email, password: "password123" });
const space = await new SpaceService(db).create(user.id, { name: `Page ${stamp}` });

// 25 docs; tag a subset.
for (let i = 0; i < 25; i++) {
  const d = await docs.create(user.id, space.id, { title: `Doc ${String(i).padStart(2, "0")}`, content: `# Doc ${i}\n` });
  if (i < 7) await tags.setDocumentTags(user.id, d.id, ["batch"]);
}

check("count returns the full total", (await docs.count(user.id, space.id)) === 25);
const p1 = await docs.list(user.id, space.id, { limit: 10, offset: 0 });
const p2 = await docs.list(user.id, space.id, { limit: 10, offset: 10 });
const p3 = await docs.list(user.id, space.id, { limit: 10, offset: 20 });
check("pages have 10 / 10 / 5 items", p1.length === 10 && p2.length === 10 && p3.length === 5);
const ids = new Set([...p1, ...p2, ...p3].map((d) => d.id));
check("pages do not overlap (25 distinct)", ids.size === 25);

const az = await docs.list(user.id, space.id, { limit: 3, sort: "title" });
check("title sort is alphabetical", az[0]!.title === "Doc 00" && az[1]!.title === "Doc 01");

check("tag count is correct", (await tags.countDocumentsByTag(user.id, space.id, "batch")) === 7);
const tp = await tags.listDocumentsByTag(user.id, space.id, "batch", { limit: 5, offset: 0 });
check("tag list paginates", tp.length === 5);

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
