/** Feature 2 verification: queue stats, failed-job listing, and retry. */
import { eq, inArray, sql } from "drizzle-orm";
import { closeDb, documents, getDb, jobs, spaces, users } from "@ai-brain/db";
import { AdminService, AuthService, DocumentService, QueueService, SpaceService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const docs = new DocumentService(db);
const queue = new QueueService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "qo";
const email = `qops_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await auth.register({ email, password: "password123" });
await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
const admin = new AdminService(db);
const space = await new SpaceService(db).create(user.id, { name: `QOps ${stamp}` });

// Create a doc (enqueues a reindex), then force that job + the doc into "failed".
const doc = await docs.create(user.id, space.id, { title: "Stuck", content: "# Stuck\n" });
await db.update(jobs).set({ status: "failed", attempts: 5, lastError: "embedding backend down" }).where(sql`payload->>'documentId' = ${doc.id}`);
await db.update(documents).set({ indexStatus: "failed" }).where(eq(documents.id, doc.id));

const stats = await admin.jobStats(user.id);
check("stats report a failed job", stats.failed >= 1);
const failed = await admin.failedJobs(user.id);
const target = failed.find((j) => (j.payload as { documentId?: string }).documentId === doc.id);
check("failed job is listed with its error", target?.lastError === "embedding backend down");

// Retry → job back to pending (attempts reset) and the doc back to pending.
const n = await admin.retryJob(user.id, target!.id);
check("retry requeued one job", n === 1);
const after = await db.query.jobs.findFirst({ where: eq(jobs.id, target!.id) });
check("job is pending again with attempts reset", after?.status === "pending" && after?.attempts === 0);
check("the document is back to index_status=pending", (await docs.getByIdUnscoped(doc.id))!.indexStatus === "pending");

// Non-admin is blocked.
const other = await auth.register({ email: `qops2_${stamp}@example.com`, password: "password123" });
check("non-admin cannot inspect the queue", await admin.jobStats(other.id).then(() => false).catch(() => true));

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(inArray(users.id, [user.id, other.id]));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
