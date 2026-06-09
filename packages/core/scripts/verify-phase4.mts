/**
 * Phase 4 verification: wiki-link extraction, resolution (incl. unresolved →
 * resolved when the target is created later), and backlinks.
 */
import { eq } from "drizzle-orm";
import { closeDb, documents, getDb, users } from "@ai-brain/db";
import { DocumentService, LinkService } from "@ai-brain/core";

const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
await db.delete(documents).where(eq(documents.ownerId, user.id)); // clean slate

const docs = new DocumentService(db);
const linksvc = new LinkService(db);
let failures = 0;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};

// 1. Create a note that links to a doc that does NOT exist yet.
const notes = await docs.create(user.id, {
  title: "Meeting notes",
  content: "We discussed the [[Roadmap]] and [[Q3 Plan|the plan]].\n",
});
let outbound = await linksvc.outboundLinks(notes.id);
check("two outbound links extracted", outbound.length === 2);
check("links are unresolved before targets exist", outbound.every((l) => !l.resolved));

// 2. Create the target — the previously-unresolved link should now resolve.
const roadmap = await docs.create(user.id, { title: "Roadmap", content: "# Roadmap\n" });
outbound = await linksvc.outboundLinks(notes.id);
const roadmapLink = outbound.find((l) => l.targetRaw === "Roadmap");
check("inbound link resolves when target is created", roadmapLink?.resolved === true);
check("resolved link points at the new doc", roadmapLink?.targetDocumentId === roadmap.id);

// 3. Backlinks: Roadmap should be linked from Meeting notes.
const backlinks = await docs.backlinks(user.id, roadmap.id);
check("roadmap has one backlink", backlinks.length === 1);
check("backlink is the notes doc", backlinks[0]?.documentId === notes.id);

// 4. Editing content to drop the link removes the backlink.
await docs.update(user.id, notes.id, { content: "Nothing links out now.\n" });
check("backlink removed after edit", (await docs.backlinks(user.id, roadmap.id)).length === 0);

// 5. resolveTarget resolves by title and slug.
check("resolveTarget by title", (await linksvc.resolveTarget(user.id, "Roadmap")) === roadmap.id);
check("resolveTarget by slug", (await linksvc.resolveTarget(user.id, "roadmap")) === roadmap.id);
check("resolveTarget unknown → null", (await linksvc.resolveTarget(user.id, "Nope")) === null);

await db.delete(documents).where(eq(documents.ownerId, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
