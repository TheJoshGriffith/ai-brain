/** Feature 3 verification: login brute-force lockout via the shared limiter. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, users } from "@ai-brain/db";
import { AuthService, loginLimiter } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "rl";
const email = `rl_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
await auth.register({ email, password: "correct-horse" });
loginLimiter.reset(email);

check("correct password works initially", Boolean(await auth.verifyCredentials(email, "correct-horse")));

// Hammer with wrong passwords past the threshold (10 / 5 min).
for (let i = 0; i < 11; i++) await auth.verifyCredentials(email, "wrong");
check("repeated failures lock the account", loginLimiter.isLimited(email));
check("even the correct password is now blocked", (await auth.verifyCredentials(email, "correct-horse")) === null);

loginLimiter.reset(email);
check("after reset, correct password works again", Boolean(await auth.verifyCredentials(email, "correct-horse")));

await db.delete(users).where(eq(users.email, email));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
