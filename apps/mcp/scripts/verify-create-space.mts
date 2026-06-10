/** Verifies the create_space MCP path: PAT auth -> scope check -> space created. */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, spaces, users } from "@ai-brain/db";
import { AuthService, TokenService } from "@ai-brain/core";
import { authenticate, requireScope } from "../src/context.js";

const db = getDb();
let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };

const stamp = process.argv[2] ?? "cs";
const email = `mcpspace_${stamp}@example.com`;
await db.delete(users).where(inArray(users.email, [email]));
const user = await new AuthService(db).register({ email, password: "password123" });
const tokens = new TokenService(db);

// A PAT WITHOUT spaces:write must be blocked.
const ro = await tokens.create(user.id, { name: "ro", scopes: ["spaces:read"] });
const roCtx = (await authenticate(ro.token))!;
let blocked = false;
try { requireScope(roCtx, "spaces:write"); } catch { blocked = true; }
check("spaces:read token is denied spaces:write", blocked);

// A PAT WITH spaces:write can create a space (mirrors the tool's handler body).
const rw = await tokens.create(user.id, { name: "rw", scopes: ["spaces:write"] });
const ctx = (await authenticate(rw.token))!;
requireScope(ctx, "spaces:write");
const space = await ctx.spaces.create(ctx.userId, { name: `Via MCP ${stamp}` });
check("create_space returns a space with an id", Boolean(space?.id));
check("creator is the owner", space.role === "owner");

const listed = await ctx.spaces.list(ctx.userId);
check("new space shows up in list_spaces", listed.some((s) => s.id === space.id));

await db.delete(spaces).where(eq(spaces.id, space.id));
await db.delete(users).where(eq(users.id, user.id));
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
