/** Sub-phase A over HTTP: spaces + space-scoped documents/search via REST + PAT. */
import { eq } from "drizzle-orm";
import { closeDb, documents, getDb, users } from "@ai-brain/db";
import { TokenService } from "@ai-brain/core";

const base = "http://localhost:3002";
const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
await db.delete(documents).where(eq(documents.authorId, user.id));
const tok = (await new TokenService(db).create(user.id, {
  name: "spaces-http",
  scopes: ["documents:read", "documents:write", "search:read", "spaces:read", "spaces:write"],
})).token;
const h = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const spacesRes = await (await fetch(`${base}/api/spaces`, { headers: h })).json();
check("GET /api/spaces returns the Personal space", spacesRes.spaces?.some((s: { isPersonal: boolean }) => s.isPersonal));

const created = await (await fetch(`${base}/api/spaces`, { method: "POST", headers: h, body: JSON.stringify({ name: "HTTP Space" }) })).json();
const spaceId = created.space?.id as string;
check("POST /api/spaces creates a space (owner)", created.space?.role === "owner");

const doc = await (await fetch(`${base}/api/documents`, { method: "POST", headers: h, body: JSON.stringify({ spaceId, content: "# Quarterly goals\n\nShip the search feature.\n" }) })).json();
check("POST /api/documents into the space", doc.document?.spaceId === spaceId);

const missingSpace = await fetch(`${base}/api/documents`, { method: "POST", headers: h, body: JSON.stringify({ content: "x" }) });
check("create without spaceId → 400", missingSpace.status === 400);

const list = await (await fetch(`${base}/api/documents?spaceId=${spaceId}`, { headers: h })).json();
check("GET /api/documents?spaceId lists in space", list.documents?.length === 1);

const search = await (await fetch(`${base}/api/search?spaceId=${spaceId}&q=${encodeURIComponent("shipping features")}`, { headers: h })).json();
check("semantic search within the space", Array.isArray(search.results) && search.results.length >= 1);

// cleanup: delete the space via API, revoke token
await fetch(`${base}/api/spaces/${spaceId}`, { method: "DELETE", headers: h });
for (const t of await new TokenService(db).list(user.id)) if (t.name === "spaces-http") await new TokenService(db).revoke(user.id, t.id);
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
