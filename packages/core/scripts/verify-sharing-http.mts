/** Sub-phase C over HTTP: anonymous /share/[token] renders the doc; bad token fails. */
import { eq } from "drizzle-orm";
import { closeDb, documents, getDb, spaces, users } from "@ai-brain/db";
import { DocumentService, SharingService, SpaceService } from "@ai-brain/core";

const base = "http://localhost:3002";
const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
const space = await new SpaceService(db).ensurePersonalSpace(user.id);
const doc = await new DocumentService(db).create(user.id, space.id, { title: "Public Memo", content: "# Public Memo\n\nAnyone with the link can read this.\n" });
const { token } = await new SharingService(db).createDocumentLink(user.id, doc.id, { role: "viewer", allowAnonymous: true });

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const page = await (await fetch(`${base}/share/${token}`)).text();
check("anonymous share page renders the document", page.includes("Public Memo") && page.includes("Anyone with the link"));

const bad = await (await fetch(`${base}/share/aib_not_a_real_token`)).text();
check("invalid token shows an error page", bad.includes("isn’t valid") || bad.includes("isn't valid"));

await db.delete(documents).where(eq(documents.id, doc.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
