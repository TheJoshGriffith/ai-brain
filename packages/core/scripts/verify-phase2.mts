import { eq } from "drizzle-orm";
import { getDb, closeDb, users } from "@ai-brain/db";
import { AuthService, TokenService } from "@ai-brain/core";

const db = getDb();
const auth = new AuthService(db);
const tokens = new TokenService(db);
const email = `verify+${Date.now()}@example.com`;
const password = "supersecret123";

function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) process.exitCode = 1;
}

const user = await auth.register({ email, password, name: "Verify" });
check("register creates user", Boolean(user.id) && user.email === email);

check("verifyCredentials accepts correct password", Boolean(await auth.verifyCredentials(email, password)));
check("verifyCredentials rejects wrong password", (await auth.verifyCredentials(email, "nope")) === null);

const dup = await auth.register({ email, password, name: "Dup" }).then(() => false).catch(() => true);
check("register rejects duplicate email", dup);

const { token, summary } = await tokens.create(user.id, {
  name: "test token",
  scopes: ["documents:read", "search:read"],
});
check("token is prefixed", token.startsWith("aib_"));
check("summary exposes no hash", !("tokenHash" in summary));

const principal = await tokens.authenticate(token);
check("authenticate resolves principal", principal?.userId === user.id);
check("principal carries scopes", JSON.stringify(principal?.scopes) === JSON.stringify(["documents:read", "search:read"]));
check("authenticate rejects bad token", (await tokens.authenticate("aib_invalid")) === null);

const list = await tokens.list(user.id);
check("list returns the token without hash", list.length === 1 && !("tokenHash" in (list[0] ?? {})));

check("revoke succeeds", await tokens.revoke(user.id, summary.id));
check("authenticate fails after revoke", (await tokens.authenticate(token)) === null);

await db.delete(users).where(eq(users.id, user.id));
console.log("— cleaned up test user —");
await closeDb();
