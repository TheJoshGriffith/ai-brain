/**
 * End-to-end REST verification against the running dev server.
 * Usage: node --import tsx scripts/verify-phase3-http.mts <baseUrl> <email>
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb, users } from "@ai-brain/db";
import { TokenService } from "@ai-brain/core";

const base = process.argv[2] ?? "http://localhost:3002";
const email = process.argv[3] ?? "josh@example.com";

const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, email) });
if (!user) throw new Error(`No user ${email}`);
// Start from a clean slate for deterministic slug assertions.
const { documents } = await import("@ai-brain/db");
await db.delete(documents).where(eq(documents.ownerId, user.id));
const tokens = new TokenService(db);
const rw = (await tokens.create(user.id, { name: "rw", scopes: ["documents:read", "documents:write"] })).token;
const ro = (await tokens.create(user.id, { name: "ro", scopes: ["documents:read"] })).token;

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
}
const h = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

check("no auth → 401", (await fetch(`${base}/api/documents`)).status === 401);

const created = await fetch(`${base}/api/documents`, {
  method: "POST",
  headers: h(rw),
  body: JSON.stringify({ content: "# Meeting notes\n\nDiscussed the [[Roadmap]].\n" }),
});
const createdBody = await created.json();
const id = createdBody.document?.id as string;
check("create → 201", created.status === 201);
check("title derived from heading", createdBody.document?.title === "Meeting notes");
check("slug generated", createdBody.document?.slug === "meeting-notes");

check(
  "read-only token cannot write → 403",
  (await fetch(`${base}/api/documents`, { method: "POST", headers: h(ro), body: "{}" })).status === 403,
);

const patched = await fetch(`${base}/api/documents/${id}`, {
  method: "PATCH",
  headers: h(rw),
  body: JSON.stringify({ title: "Renamed notes" }),
});
const patchedBody = await patched.json();
check("patch title → 200", patched.status === 200 && patchedBody.document?.title === "Renamed notes");

const fetched = await (await fetch(`${base}/api/documents/${id}`, { headers: h(ro) })).json();
check("get by id returns content", fetched.document?.content?.includes("Roadmap"));

const list = await (await fetch(`${base}/api/documents`, { headers: h(ro) })).json();
check("list includes the doc", list.documents?.some((d: { id: string }) => d.id === id));

check("delete → ok", (await (await fetch(`${base}/api/documents/${id}`, { method: "DELETE", headers: h(rw) })).json()).deleted === true);
check("get after delete → 404", (await fetch(`${base}/api/documents/${id}`, { headers: h(ro) })).status === 404);

// cleanup the throwaway tokens
const all = await tokens.list(user.id);
for (const t of all.filter((t) => t.name === "rw" || t.name === "ro")) await tokens.revoke(user.id, t.id);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
