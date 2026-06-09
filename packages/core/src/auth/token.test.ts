import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password";
import {
  generateToken,
  hashToken,
  safeHashEquals,
  TOKEN_PREFIX,
} from "./token";
import { parseBearer } from "../services/token.service";

test("generateToken produces a prefixed secret, matching hash, and display prefix", () => {
  const t = generateToken();
  assert.ok(t.raw.startsWith(`${TOKEN_PREFIX}_`));
  assert.equal(t.hash, hashToken(t.raw));
  assert.ok(t.prefix.startsWith(`${TOKEN_PREFIX}_`));
  assert.ok(t.raw.startsWith(t.prefix));
  assert.equal(t.hash.length, 64); // sha256 hex
});

test("generateToken is unique across calls", () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.hash, b.hash);
});

test("hashToken is deterministic", () => {
  assert.equal(hashToken("aib_example"), hashToken("aib_example"));
});

test("safeHashEquals compares digests", () => {
  const h = hashToken("x");
  assert.ok(safeHashEquals(h, hashToken("x")));
  assert.ok(!safeHashEquals(h, hashToken("y")));
});

test("parseBearer extracts the token, case-insensitively", () => {
  assert.equal(parseBearer("Bearer aib_abc"), "aib_abc");
  assert.equal(parseBearer("bearer aib_abc"), "aib_abc");
  assert.equal(parseBearer("aib_abc"), null);
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(undefined), null);
});

test("password hash verifies and rejects wrong input", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.ok(await verifyPassword(hash, "correct horse battery staple"));
  assert.ok(!(await verifyPassword(hash, "wrong password")));
});
