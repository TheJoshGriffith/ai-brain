/** Unit 4 verification: registration modes, invites, reset, verification, admin gate. */
import { eq, inArray, like } from "drizzle-orm";
import { closeDb, getDb, passwordResetTokens, users, verificationTokens } from "@ai-brain/db";
import { AdminService, AuthError, AuthService, generateToken, hashToken } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const admin = new AdminService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };
const threw = (fn: () => Promise<unknown>, match?: string) =>
  fn().then(() => false).catch((e) => (match ? String(e?.message).includes(match) : e instanceof AuthError));

const stamp = process.argv[2] ?? "a";
const emails = ["adm", "b", "c", "d"].map((x) => `acct_${x}_${stamp}@example.com`);
await db.delete(users).where(inArray(users.email, emails));

// Admin (force is_admin since the instance already has users).
const A = await auth.register({ email: emails[0]!, password: "password123" });
await db.update(users).set({ isAdmin: true }).where(eq(users.id, A.id));

// closed mode blocks registration.
await admin.setRegistrationMode(A.id, "closed");
check("closed mode blocks registration", await threw(() => auth.register({ email: emails[1]!, password: "password123" }), "disabled"));

// invite mode requires a valid invitation.
await admin.setRegistrationMode(A.id, "invite");
check("invite mode rejects sign-up without a token", await threw(() => auth.register({ email: emails[1]!, password: "password123" }), "invitation"));
const { url } = await admin.createInvitation(A.id, emails[1]!);
const inviteToken = new URL(url).searchParams.get("invite")!;
const B = await auth.register({ email: emails[1]!, password: "password123", inviteToken });
check("invite mode accepts a valid invitation", Boolean(B.id));

// open mode lets anyone in.
await admin.setRegistrationMode(A.id, "open");
const C = await auth.register({ email: emails[2]!, password: "password123" });
check("open mode allows registration", Boolean(C.id));

// Email verification (token stored raw in verification_tokens).
const vrow = await db.query.verificationTokens.findFirst({ where: eq(verificationTokens.identifier, emails[2]!) });
check("registration created a verification token", Boolean(vrow));
check("verifyEmail confirms the address", await auth.verifyEmail(vrow!.token));
check("user is now verified", (await auth.getUserById(C.id))!.emailVerified != null);

// Password reset.
const raw = generateToken().raw;
await db.insert(passwordResetTokens).values({ userId: C.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 3600_000) });
await auth.resetPassword(raw, "newpassword456");
check("reset sets a new working password", Boolean(await auth.verifyCredentials(emails[2]!, "newpassword456")));
check("old password no longer works", (await auth.verifyCredentials(emails[2]!, "password123")) === null);
check("reused reset token is rejected", await threw(() => auth.resetPassword(raw, "another123"), "Invalid"));

// requireEmailVerification gate.
process.env.REQUIRE_EMAIL_VERIFICATION = "true";
const D = await auth.register({ email: emails[3]!, password: "password123" });
check("unverified user blocked when verification required", (await auth.verifyCredentials(emails[3]!, "password123")) === null);
const drow = await db.query.verificationTokens.findFirst({ where: eq(verificationTokens.identifier, emails[3]!) });
await auth.verifyEmail(drow!.token);
check("verified user can sign in", Boolean(await auth.verifyCredentials(emails[3]!, "password123")));
delete process.env.REQUIRE_EMAIL_VERIFICATION;

// Admin gating.
check("non-admin cannot list users", await threw(() => admin.listUsers(C.id), "Admin"));
check("admin can list users", (await admin.listUsers(A.id)).length >= 4);

await db.delete(users).where(inArray(users.id, [A.id, B.id, C.id, D.id]));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
