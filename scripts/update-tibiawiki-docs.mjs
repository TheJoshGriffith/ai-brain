#!/usr/bin/env node
/**
 * Apply content updates to existing TibiaWiki documents in AI Brain.
 * Reads a JSONL of {slug, content} and PATCHes each matching document in the space.
 *
 * Usage:
 *   AI_BRAIN_TOKEN=<PAT> node scripts/update-tibiawiki-docs.mjs \
 *     [--file data/tibiawiki/quest_spoiler_updates.jsonl] [--url http://10.0.0.20:3007] \
 *     [--space TibiaWiki] [--concurrency 6]
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = (opt("url", "http://10.0.0.20:3007")).replace(/\/$/, "");
const FILE = opt("file", "data/tibiawiki/quest_spoiler_updates.jsonl");
const SPACE = opt("space", "TibiaWiki");
const CONCURRENCY = Number(opt("concurrency", "6"));
const TOKEN = process.env.AI_BRAIN_TOKEN;
if (!TOKEN) {
  console.error("AI_BRAIN_TOKEN env var is required");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const api = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
};

const { spaces } = await api("GET", "/api/spaces");
const space = spaces.find((s) => s.name === SPACE);
if (!space) { console.error(`Space "${SPACE}" not found`); process.exit(1); }

// slug → id map for the whole space
console.log("Building slug→id map…");
const bySlug = new Map();
for (let offset = 0; ; ) {
  const { documents } = await api("GET", `/api/documents?spaceId=${space.id}&limit=200&offset=${offset}`);
  for (const d of documents) bySlug.set(d.slug, d.id);
  if (documents.length === 0) break;
  offset += documents.length;
}
console.log(`${bySlug.size} documents in space`);

const updates = [];
const rl = createInterface({ input: createReadStream(FILE) });
for await (const line of rl) if (line.trim()) updates.push(JSON.parse(line));

let ok = 0, missing = 0, failed = 0;
const failures = [];
const queue = [...updates];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const u = queue.shift();
    if (!u) return;
    const id = bySlug.get(u.slug);
    if (!id) { missing++; continue; }
    try {
      await api("PATCH", `/api/documents/${id}`, { content: u.content });
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok} updated`);
    } catch (e) {
      failed++;
      failures.push(`${u.slug}: ${e.message}`);
    }
  }
}));

console.log(`\nDone. updated=${ok} missing-slug=${missing} failed=${failed}`);
for (const f of failures.slice(0, 20)) console.log("  " + f);
