import "./env.js";
import { getDb, type Job } from "@ai-brain/db";
import { IndexingService, QueueService } from "@ai-brain/core";

const POLL_MS = 1000;
const BATCH = 5;

const db = getDb();
const queue = new QueueService(db);
const indexer = new IndexingService(db);

let running = true;

async function handle(job: Job): Promise<void> {
  switch (job.type) {
    case "reindex": {
      const documentId = String((job.payload as { documentId?: string }).documentId ?? "");
      if (documentId) await indexer.reindexById(documentId);
      break;
    }
    case "purge_trash":
      // Retention purge is wired up in the version-history/trash unit.
      break;
  }
}

async function tick(): Promise<number> {
  const claimed = await queue.claim(BATCH);
  for (const job of claimed) {
    try {
      await handle(job);
      await queue.complete(job.id);
    } catch (error) {
      console.warn(`[worker] job ${job.id} (${job.type}) failed:`, error);
      await queue.fail(job, error);
    }
  }
  return claimed.length;
}

async function main() {
  console.error("ai-brain worker started");
  while (running) {
    let processed = 0;
    try {
      processed = await tick();
    } catch (error) {
      console.error("[worker] tick error:", error);
    }
    // Back off only when idle; drain bursts without waiting.
    if (processed === 0) await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    running = false;
    console.error("ai-brain worker stopping");
    setTimeout(() => process.exit(0), 200);
  });
}

void main();
