import assert from "node:assert/strict";
import { test } from "node:test";
import { RateLimiter } from "./rate-limit";

test("RateLimiter allows up to max then blocks", () => {
  const rl = new RateLimiter(2, 10_000);
  assert.equal(rl.consume("k"), true);
  assert.equal(rl.consume("k"), true);
  assert.equal(rl.consume("k"), false);
  assert.equal(rl.isLimited("k"), true);
});

test("RateLimiter keys are independent and reset clears", () => {
  const rl = new RateLimiter(1, 10_000);
  assert.equal(rl.consume("a"), true);
  assert.equal(rl.consume("a"), false);
  assert.equal(rl.consume("b"), true); // different key
  rl.reset("a");
  assert.equal(rl.consume("a"), true);
});

test("RateLimiter window expiry frees capacity", async () => {
  const rl = new RateLimiter(1, 30);
  assert.equal(rl.consume("k"), true);
  assert.equal(rl.consume("k"), false);
  await new Promise((r) => setTimeout(r, 45));
  assert.equal(rl.consume("k"), true);
});
