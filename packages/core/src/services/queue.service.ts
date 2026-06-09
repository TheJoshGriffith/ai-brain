import { desc, eq, inArray, sql } from "drizzle-orm";
import { documents, jobs, type Database, type Job } from "@ai-brain/db";

export type JobType = "reindex" | "purge_trash";

export interface JobStats {
  pending: number;
  running: number;
  failed: number;
  done: number;
}

const MAX_ATTEMPTS = 5;

/**
 * Minimal Postgres-backed job queue. Workers claim jobs with
 * FOR UPDATE SKIP LOCKED so multiple workers can run safely. Reindex jobs
 * coalesce per document via a partial unique index (jobs_pending_reindex_idx).
 */
export class QueueService {
  constructor(private readonly db: Database) {}

  async enqueue(type: JobType, payload: Record<string, unknown> = {}, opts: { runAt?: Date } = {}): Promise<void> {
    await this.db
      .insert(jobs)
      .values({ type, payload, runAt: opts.runAt ?? new Date() })
      .onConflictDoNothing(); // coalesce duplicate pending reindex jobs
  }

  /** Enqueue (or coalesce) an embedding reindex for a document. */
  enqueueReindex(documentId: string): Promise<void> {
    return this.enqueue("reindex", { documentId });
  }

  /** Atomically claim up to `limit` runnable jobs and mark them running. */
  async claim(limit = 1): Promise<Job[]> {
    const { rows } = await this.db.execute(sql`
      update jobs set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
      where id in (
        select id from jobs
        where status = 'pending' and run_at <= now()
        order by run_at asc
        for update skip locked
        limit ${limit}
      )
      returning *
    `);
    return rows as unknown as Job[];
  }

  async complete(jobId: string): Promise<void> {
    await this.db.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }

  /** Re-queue with exponential backoff, or mark failed after MAX_ATTEMPTS. */
  async fail(job: Job, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    if (job.attempts >= MAX_ATTEMPTS) {
      await this.db.update(jobs).set({ status: "failed", lastError: message, updatedAt: new Date() }).where(eq(jobs.id, job.id));
      return;
    }
    const backoffMs = Math.min(30_000, 1000 * 2 ** job.attempts);
    await this.db
      .update(jobs)
      .set({ status: "pending", lastError: message, runAt: new Date(Date.now() + backoffMs), lockedAt: null, updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
  }

  // --- Operability (used by the admin dashboard) ---------------------------

  async stats(): Promise<JobStats> {
    const rows = await this.db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs).groupBy(jobs.status);
    const out: JobStats = { pending: 0, running: 0, failed: 0, done: 0 };
    for (const r of rows) if (r.status in out) out[r.status as keyof JobStats] = r.n;
    return out;
  }

  listFailed(limit = 50): Promise<Job[]> {
    return this.db.select().from(jobs).where(eq(jobs.status, "failed")).orderBy(desc(jobs.updatedAt)).limit(limit);
  }

  /** Requeue specific jobs (or all failed ones) and reset their docs to pending. */
  private async requeue(predicateIds: string[] | null): Promise<number> {
    const failed = predicateIds
      ? await this.db.select().from(jobs).where(inArray(jobs.id, predicateIds))
      : await this.db.select().from(jobs).where(eq(jobs.status, "failed"));
    if (failed.length === 0) return 0;

    const ids = failed.map((j) => j.id);
    await this.db
      .update(jobs)
      .set({ status: "pending", attempts: 0, lastError: null, runAt: new Date(), lockedAt: null, updatedAt: new Date() })
      .where(inArray(jobs.id, ids));

    const docIds = failed
      .filter((j) => j.type === "reindex")
      .map((j) => (j.payload as { documentId?: string }).documentId)
      .filter((d): d is string => Boolean(d));
    if (docIds.length) {
      await this.db.update(documents).set({ indexStatus: "pending" }).where(inArray(documents.id, docIds));
    }
    return ids.length;
  }

  retry(jobId: string): Promise<number> {
    return this.requeue([jobId]);
  }
  retryAllFailed(): Promise<number> {
    return this.requeue(null);
  }
}
