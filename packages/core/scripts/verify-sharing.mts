/** Sub-phase C verification: public share links, expiry, claim, per-doc overrides. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AccessService, AuthService, DocumentForbiddenError, DocumentService, SharingService, SpaceService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const spaceSvc = new SpaceService(db);
const docs = new DocumentService(db);
const share = new SharingService(db);
const access = new AccessService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };
const denied = (fn: () => Promise<unknown>) => fn().then(() => false).catch((e) => e instanceof DocumentForbiddenError);

const stamp = process.argv[2] ?? "sh";
const emails = ["a", "b", "c", "d"].map((x) => `${x}_${stamp}@example.com`);
await db.delete(users).where(inArray(users.email, emails));
const [A, B, C, D] = await Promise.all(emails.map((email) => auth.register({ email, password: "password123" })));
const space = await spaceSvc.create(A!.id, { name: `Share ${stamp}` });
const doc = await docs.create(A!.id, space.id, { title: "Secret plan", content: "# Secret plan\n\nLaunch in Q4.\n" });

// Anonymous viewer link.
const anon = await share.createDocumentLink(A!.id, doc.id, { role: "viewer", allowAnonymous: true });
const anonGrant = await share.resolveToken(anon.token);
check("anonymous link resolves", anonGrant?.allowAnonymous === true && anonGrant?.role === "viewer" && anonGrant?.resourceId === doc.id);

// Login-required editor link.
const edit = await share.createDocumentLink(A!.id, doc.id, { role: "editor", allowAnonymous: false });
check("editor link resolves, not anonymous", (await share.resolveToken(edit.token))?.role === "editor");

// Expired link.
const expired = await share.createDocumentLink(A!.id, doc.id, { role: "viewer", expiresAt: new Date(Date.now() - 1000) });
check("expired link does not resolve", (await share.resolveToken(expired.token)) === null);

// B claims the editor link → gains write via per-doc override.
check("B has no access before claim", (await access.resolveDocumentAccess(B!.id, doc.id)) === null);
await share.claimDocumentLink(B!.id, edit.token);
const bAccess = await access.resolveDocumentAccess(B!.id, doc.id);
check("B can write after claiming editor link", bAccess?.canWrite === true);

// C claims viewer link → read only.
await share.claimDocumentLink(C!.id, anon.token);
const cAccess = await access.resolveDocumentAccess(C!.id, doc.id);
check("C can read but not write after viewer claim", cAccess?.canRead === true && cAccess?.canWrite === false);

// Revoke the editor link → stops resolving (existing claims persist by design).
await share.revokeLink(A!.id, edit.share.id);
check("revoked link no longer resolves", (await share.resolveToken(edit.token)) === null);

// Per-document member override added directly.
await share.addDocumentMember(A!.id, doc.id, { email: D!.email, role: "viewer" });
check("D gets read via per-doc override", (await access.resolveDocumentAccess(D!.id, doc.id))?.canRead === true);
check("D cannot list the space (not a member)", await denied(() => docs.list(D!.id, space.id)));

// A non-writer cannot create links: add C as a space viewer; C still can't make links.
await spaceSvc.addMember(A!.id, space.id, { email: C!.email, role: "viewer" });
check("viewer cannot create share links", await denied(() => share.createDocumentLink(C!.id, doc.id, { role: "viewer" })));

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(inArray(users.id, [A!.id, B!.id, C!.id, D!.id]));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
