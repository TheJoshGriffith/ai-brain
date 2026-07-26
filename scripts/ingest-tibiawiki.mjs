#!/usr/bin/env node
/**
 * Ingest the TibiaWiki dump into AI Brain as documents.
 *
 * Reads data/tibiawiki/tibiawiki_docs.jsonl (one doc per line: {slug, title, tags, content})
 * and POSTs each as a document into a "TibiaWiki" space via the REST API.
 *
 * Usage:
 *   AI_BRAIN_TOKEN=<PAT with spaces:read spaces:write documents:write> \
 *     node scripts/ingest-tibiawiki.mjs [options]
 *
 * Options:
 *   --url <base>          AI Brain base URL   (default: http://10.0.0.20:3007)
 *   --file <path>         JSONL file          (default: data/tibiawiki/tibiawiki_docs.jsonl)
 *   --space <name>        Space name          (default: TibiaWiki)
 *   --concurrency <n>     Parallel requests   (default: 6)
 *   --no-tags             Skip the per-document tags request (faster; tags stay in frontmatter)
 *   --limit <n>           Only ingest first n docs (for a smoke test)
 *
 * Progress is checkpointed to <file>.progress — re-running resumes where it left off.
 */
import { createReadStream, existsSync, readFileSync, appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = (opt("url", "http://10.0.0.20:3007")).replace(/\/$/, "");
const FILE = opt("file", "data/tibiawiki/tibiawiki_docs.jsonl");
const SPACE = opt("space", "TibiaWiki");
const CONCURRENCY = Number(opt("concurrency", "6"));
const LIMIT = Number(opt("limit", "0"));
const DO_TAGS = !args.includes("--no-tags");
const TOKEN = process.env.AI_BRAIN_TOKEN;
if (!TOKEN) {
  console.error("AI_BRAIN_TOKEN env var is required (PAT with spaces:read spaces:write documents:write)");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const api = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

// -- resolve or create the space --------------------------------------------
const { spaces } = await api("GET", "/api/spaces");
let space = spaces.find((s) => s.name === SPACE);
if (!space) {
  ({ space } = await api("POST", "/api/spaces", { name: SPACE }));
  console.log(`Created space "${SPACE}" (${space.id})`);
} else {
  console.log(`Using existing space "${SPACE}" (${space.id})`);
}

// -- resume checkpoint -------------------------------------------------------
const progressFile = `${FILE}.progress`;
const done = new Set(
  existsSync(progressFile) ? readFileSync(progressFile, "utf8").split("\n").filter(Boolean) : [],
);
if (done.size) console.log(`Resuming: ${done.size} docs already ingested`);

// -- stream + ingest ---------------------------------------------------------
let ok = 0, skipped = 0, failed = 0, read = 0;
const failures = [];
const queue = [];
const worker = async () => {
  for (;;) {
    const doc = queue.shift();
    if (!doc) {
      if (streamDone) return;
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    try {
      const { document } = await api("POST", "/api/documents", {
        spaceId: space.id,
        title: doc.title,
        slug: doc.slug,
        content: doc.content,
      });
      if (DO_TAGS) await api("PUT", `/api/documents/${document.id}/tags`, { tags: doc.tags });
      appendFileSync(progressFile, `${doc.slug}\n`);
      ok++;
      if (ok % 250 === 0) console.log(`  ${ok} ingested (${failed} failed)`);
    } catch (e) {
      failed++;
      failures.push(`${doc.slug}: ${e.message}`);
    }
  }
};

let streamDone = false;
const workers = Array.from({ length: CONCURRENCY }, worker);
const rl = createInterface({ input: createReadStream(FILE) });
for await (const line of rl) {
  if (!line.trim()) continue;
  read++;
  if (LIMIT && read > LIMIT) break;
  const doc = JSON.parse(line);
  // Titles of pure punctuation (e.g. the NPC literally named "...") slugify to "".
  if (!doc.slug) doc.slug = `page-${Buffer.from(doc.title).toString("hex").slice(0, 16)}`;
  if (done.has(doc.slug)) { skipped++; continue; }
  queue.push(doc);
  while (queue.length > CONCURRENCY * 4) await new Promise((r) => setTimeout(r, 25));
}
streamDone = true;
await Promise.all(workers);

console.log(`\nDone. ingested=${ok} resumed-skip=${skipped} failed=${failed}`);
if (failures.length) {
  console.log("Failures (first 20):");
  for (const f of failures.slice(0, 20)) console.log("  " + f);
  console.log("Re-run the same command to retry failures (successes are checkpointed).");
}
