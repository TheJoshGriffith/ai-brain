import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTag } from "./tag.service";

test("normalizeTag lowercases, trims, and collapses whitespace", () => {
  assert.equal(normalizeTag("  Project   Alpha "), "project alpha");
  assert.equal(normalizeTag("TODO"), "todo");
  assert.equal(normalizeTag(""), "");
});
