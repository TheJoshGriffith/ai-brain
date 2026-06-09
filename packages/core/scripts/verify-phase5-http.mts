/** Phase 5 over HTTP: create a doc via REST, then hybrid-search via REST. */
import { eq } from "drizzle-orm";
import { closeDb, documents, getDb, users } from "@ai-brain/db";
import { TokenService } from "@ai-brain/core";

const base = "http://localhost:3002";
const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
await db.delete(documents).where(eq(documents.ownerId, user.id));
const tok = (await new TokenService(db).create(user.id, {
  name: "p5",
  scopes: ["documents:read", "documents:write", "search:read"],
})).token;
const h = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

await fetch(`${base}/api/documents`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ title: "Pour-over technique", content: "Medium-fine grind, water at 95 degrees, bloom thirty seconds.\n" }),
});

const fts = await (await fetch(`${base}/api/search?q=grind`, { headers: h })).json();
check("REST search (full-text) finds the doc", fts.results?.some((r: { title: string }) => r.title === "Pour-over technique"));

const sem = await (await fetch(`${base}/api/search?q=${encodeURIComponent("how do I prepare espresso")}`, { headers: h })).json();
const semHit = sem.results?.find((r: { title: string }) => r.title === "Pour-over technique");
check("REST search (semantic paraphrase) finds the doc", Boolean(semHit));
check("semantic-only match flagged correctly", semHit?.matched?.join() === "semantic");

await db.delete(documents).where(eq(documents.ownerId, user.id));
const all = await new TokenService(db).list(user.id);
for (const t of all.filter((t) => t.name === "p5")) await new TokenService(db).revoke(user.id, t.id);
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
