import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkContent } from "./chunk";

test("chunkContent strips frontmatter and packs paragraphs", () => {
  const chunks = chunkContent("---\ntitle: X\n---\nPara one.\n\nPara two.\n", 1000);
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0]!.includes("Para one."));
  assert.ok(chunks[0]!.includes("Para two."));
  assert.ok(!chunks[0]!.includes("title: X"));
});

test("chunkContent splits when exceeding maxChars", () => {
  const chunks = chunkContent("aaaa\n\nbbbb\n\ncccc", 6);
  assert.ok(chunks.length >= 2);
});

test("chunkContent hard-splits oversized paragraphs", () => {
  const chunks = chunkContent("x".repeat(25), 10);
  assert.equal(chunks.length, 3);
});

test("chunkContent returns nothing for empty content", () => {
  assert.deepEqual(chunkContent("   \n\n  "), []);
});
