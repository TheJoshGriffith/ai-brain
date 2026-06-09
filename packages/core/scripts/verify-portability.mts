/** Unit 3 verification: export a space → re-import into a fresh space, intact. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, DocumentService, LinkService, PortabilityService, SpaceService, TagService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const docs = new DocumentService(db);
const tags = new TagService(db);
const links = new LinkService(db);
const port = new PortabilityService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "p";
const email = `port_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await auth.register({ email, password: "password123" });
const src = await new SpaceService(db).create(user.id, { name: `Source ${stamp}` });

// Two docs, one linking to the other, with tags.
const roadmap = await docs.create(user.id, src.id, { title: "Roadmap", content: "# Roadmap\n\nQ4 plans.\n" });
await tags.setDocumentTags(user.id, roadmap.id, ["planning", "q4"]);
await docs.create(user.id, src.id, { title: "Notes", content: "# Notes\n\nSee [[Roadmap]] for details.\n" });

// Export → unzip → import into a fresh space.
const { bytes } = await port.exportSpace(user.id, src.id);
check("export produced a non-empty zip", bytes.byteLength > 0);
const entries = PortabilityService.unzipMarkdown(bytes);
check("zip contains 2 markdown files", entries.length === 2);

const dst = await new SpaceService(db).create(user.id, { name: `Dest ${stamp}` });
const result = await port.importFiles(user.id, dst.id, entries);
check("imported 2 documents", result.imported === 2 && result.skipped === 0);

const imported = await docs.list(user.id, dst.id);
check("both documents exist in the new space", imported.length === 2);

const importedRoadmap = imported.find((d) => d.title === "Roadmap");
check("tags survived the round-trip", importedRoadmap != null && JSON.stringify(await tags.getDocumentTags(importedRoadmap.id)) === JSON.stringify(["planning", "q4"]));

const importedNotes = imported.find((d) => d.title === "Notes")!;
const outbound = await links.outboundLinks(importedNotes.id);
check("[[Roadmap]] link resolved in the new space", outbound.some((l) => l.resolved && l.targetDocumentId === importedRoadmap!.id));

await db.delete(spaces).where(inArray(spaces.id, [src.id, dst.id]));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
