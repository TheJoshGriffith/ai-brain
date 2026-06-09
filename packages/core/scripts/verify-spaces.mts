/**
 * Sub-phase A verification: multi-user space access control.
 * Exercises space membership roles, write-gating, non-member denial, and
 * per-document overrides — all against the real DB.
 */
import { eq, inArray } from "drizzle-orm";
import { closeDb, documentMembers, getDb, spaces, users } from "@ai-brain/db";
import {
  AccessService,
  AuthService,
  DocumentForbiddenError,
  DocumentService,
  SpaceService,
} from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const spaceSvc = new SpaceService(db);
const docs = new DocumentService(db);
const access = new AccessService(db);

let failures = 0;
const check = (label: string, cond: boolean) => { console.log(`${cond ? "✓" : "✗"} ${label}`); if (!cond) failures++; };
const denied = async (fn: () => Promise<unknown>) =>
  fn().then(() => false).catch((e) => e instanceof DocumentForbiddenError);

// Fresh test users (cleaned at the end).
const stamp = process.argv[2] ?? "t";
const emails = [`a_${stamp}@example.com`, `b_${stamp}@example.com`, `c_${stamp}@example.com`];
await db.delete(users).where(inArray(users.email, emails));
const A = await auth.register({ email: emails[0]!, password: "password123", name: "A" });
const B = await auth.register({ email: emails[1]!, password: "password123", name: "B" });
const C = await auth.register({ email: emails[2]!, password: "password123", name: "C" });

// A creates a shared space + a document.
const team = await spaceSvc.create(A.id, { name: `Team ${stamp}` });
const doc = await docs.create(A.id, team.id, { title: "Shared note", content: "# Shared note\n\nHello team.\n" });
check("owner can create in their space", Boolean(doc.id));

// B is not a member yet.
check("non-member has no access", (await access.resolveDocumentAccess(B.id, doc.id)) === null);
check("non-member cannot read via service", (await docs.get(B.id, doc.id)) === undefined);

// Add B as viewer.
await spaceSvc.addMember(A.id, team.id, { email: B.email, role: "viewer" });
const bView = await access.resolveDocumentAccess(B.id, doc.id);
check("viewer can read", bView?.canRead === true);
check("viewer cannot write", bView?.canWrite === false);
check("viewer cannot create in space", await denied(() => docs.create(B.id, team.id, { content: "nope" })));
check("viewer cannot update doc", await denied(() => docs.update(B.id, doc.id, { content: "nope" })));

// Promote B to editor.
await spaceSvc.updateMemberRole(A.id, team.id, B.id, "editor");
const edited = await docs.update(B.id, doc.id, { content: "# Shared note\n\nEdited by B.\n" });
check("editor can update", edited.content.includes("Edited by B"));
const bDoc = await docs.create(B.id, team.id, { title: "By B", content: "# By B\n" });
check("editor can create", Boolean(bDoc.id));

// Commenter can read but not write.
await spaceSvc.updateMemberRole(A.id, team.id, B.id, "commenter");
const bComment = await access.resolveDocumentAccess(B.id, doc.id);
check("commenter can read + comment, not write", bComment?.canRead === true && bComment?.canComment === true && bComment?.canWrite === false);

// Per-document override: C is not a space member, but gets viewer on ONE doc.
check("C has no access before override", (await access.resolveDocumentAccess(C.id, doc.id)) === null);
await db.insert(documentMembers).values({ documentId: doc.id, userId: C.id, role: "viewer" });
const cAccess = await access.resolveDocumentAccess(C.id, doc.id);
check("doc override grants C read to one doc", cAccess?.canRead === true && cAccess?.spaceId === team.id);
check("C still cannot list the space (not a member)", await denied(() => docs.list(C.id, team.id)));

// Last-owner protection.
check("cannot remove the last owner", await spaceSvc.removeMember(A.id, team.id, A.id).then(() => false).catch(() => true));

// Cleanup.
await db.delete(spaces).where(eq(spaces.id, team.id));
await db.delete(users).where(inArray(users.id, [A.id, B.id, C.id]));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
