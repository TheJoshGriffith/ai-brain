/**
 * Unit 1 verification: async indexing via the job queue.
 * Creates docs (enqueued, status=pending), runs the worker's job handler inline,
 * asserts status flips to indexed, semantic search works, and reindex coalesces.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { closeDb, documents, getDb, jobs, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentService, IndexingService, QueueService, SearchService, SpaceService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const docs = new DocumentService(db);
const queue = new QueueService(db);
const indexer = new IndexingService(db);
const search = new SearchService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "q";
const email = `queue_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await auth.register({ email, password: "password123" });
const space = await new SpaceService(db).create(user.id, { name: `Queue ${stamp}` });

// Create a doc — should be pending + a reindex job enqueued, NOT yet embedded.
const doc = await docs.create(user.id, space.id, { title: "Async note", content: "# Async note\n\nPour-over coffee with a medium-fine grind.\n" });
const fresh = await docs.getByIdUnscoped(doc.id);
check("new doc starts index_status=pending", fresh?.indexStatus === "pending");
const pendingJobs = await db.select().from(jobs).where(eq(jobs.status, "pending"));
check("a reindex job was enqueued", pendingJobs.some((j) => j.type === "reindex" && (j.payload as { documentId?: string }).documentId === doc.id));

// Coalescing: enqueue twice more for the same doc → still one pending reindex.
await queue.enqueueReindex(doc.id);
await queue.enqueueReindex(doc.id);
const dupCount = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(jobs)
  .where(sql`type = 'reindex' and status = 'pending' and payload->>'documentId' = ${doc.id}`)
  .then((r) => r[0]?.n ?? 0);
check("duplicate reindex enqueues coalesce to one", dupCount === 1);

// Drain the queue the way the worker does.
let drained = 0;
for (;;) {
  const claimed = await queue.claim(5);
  if (claimed.length === 0) break;
  for (const job of claimed) {
    if (job.type === "reindex") await indexer.reindexById(String((job.payload as { documentId?: string }).documentId));
    await queue.complete(job.id);
    drained++;
  }
}
check("worker drained the queue", drained >= 1);

const after = await docs.getByIdUnscoped(doc.id);
check("doc flips to index_status=indexed", after?.indexStatus === "indexed" && after?.indexedAt != null);

const results = await search.search(user.id, space.id, "making espresso");
check("semantic search finds the now-indexed doc", results.some((r) => r.documentId === doc.id));

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
