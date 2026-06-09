/**
 * Phase 5 verification: indexing produces embeddings, and hybrid search returns
 * both full-text and semantic (paraphrase, no lexical overlap) hits.
 * NOTE: first run downloads the local embedding model (~30MB).
 */
import { eq, sql } from "drizzle-orm";
import { closeDb, documentChunks, documents, getDb, users } from "@ai-brain/db";
import { DocumentService, SearchService } from "@ai-brain/core";

const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
await db.delete(documents).where(eq(documents.ownerId, user.id));

const docs = new DocumentService(db);
const search = new SearchService(db);
let failures = 0;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};

console.log("Creating + embedding documents (downloads model on first run)…");
const coffee = await docs.create(user.id, {
  title: "Pour-over technique",
  content: "Use a medium-fine grind and water at 95 degrees. Bloom the grounds for thirty seconds before the main pour.\n",
});
await docs.create(user.id, {
  title: "Quarterly taxes",
  content: "Estimated payments are due in April, June, September, and January. Track deductible expenses carefully.\n",
});

// Embeddings were written?
const chunkCount = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(documentChunks)
  .where(eq(documentChunks.documentId, coffee.id))
  .then((r) => r[0]?.n ?? 0);
check("coffee doc produced embedding chunks", chunkCount > 0);

if (chunkCount === 0) {
  console.log("\n⚠ Embeddings unavailable (offline?). Skipping semantic assertions; FTS only.");
  const fts = await search.search(user.id, "grind");
  check("full-text finds the coffee doc", fts.some((r) => r.documentId === coffee.id));
} else {
  // Full-text path
  const fts = await search.search(user.id, "grind");
  const ftsHit = fts.find((r) => r.documentId === coffee.id);
  check("full-text finds 'grind'", Boolean(ftsHit));
  check("full-text hit is matched by fulltext", ftsHit?.matched.includes("fulltext") === true);

  // Semantic path: query shares NO lexemes with the doc ("espresso"/"prepare"
  // don't appear), so a hit can only come from embeddings.
  const sem = await search.search(user.id, "how do I prepare espresso");
  const semHit = sem.find((r) => r.documentId === coffee.id);
  check("semantic finds paraphrase 'prepare espresso'", Boolean(semHit));
  check("semantic hit is matched by semantic only", semHit?.matched.join() === "semantic");
}

await db.delete(documents).where(eq(documents.ownerId, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
