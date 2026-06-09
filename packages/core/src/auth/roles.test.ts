import assert from "node:assert/strict";
import { test } from "node:test";
import { canComment, canManage, canRead, canWrite, maxRole } from "./roles";

test("maxRole returns the more privileged role", () => {
  assert.equal(maxRole("viewer", "editor"), "editor");
  assert.equal(maxRole("owner", "viewer"), "owner");
  assert.equal(maxRole("commenter", "viewer"), "commenter");
  assert.equal(maxRole(null, "viewer"), "viewer");
  assert.equal(maxRole("editor", null), "editor");
  assert.equal(maxRole(null, null), null);
});

test("capability matrix", () => {
  assert.ok(canRead("viewer") && !canWrite("viewer") && !canComment("viewer"));
  assert.ok(canRead("commenter") && canComment("commenter") && !canWrite("commenter"));
  assert.ok(canWrite("editor") && canComment("editor") && !canManage("editor"));
  assert.ok(canManage("owner") && canWrite("owner"));
  assert.ok(!canRead(null));
});
