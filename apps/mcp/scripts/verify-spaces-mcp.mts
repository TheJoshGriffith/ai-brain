/** Sub-phase A over MCP: list_spaces + space-scoped tools via a real client. */
import "../src/env.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, documents, getDb, users } from "@ai-brain/db";
import { TokenService } from "@ai-brain/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
await db.delete(documents).where(eq(documents.authorId, user.id));
const tokens = new TokenService(db);
const token = (await tokens.create(user.id, {
  name: "mcp-spaces",
  scopes: ["documents:read", "documents:write", "search:read", "spaces:read", "spaces:write"],
})).token;

const transport = new StdioClientTransport({
  command: "node",
  args: ["--import", "tsx", resolve(here, "../src/stdio.ts")],
  cwd: resolve(here, ".."),
  env: { ...process.env, AI_BRAIN_TOKEN: token } as Record<string, string>,
});
const client = new Client({ name: "verify", version: "1.0.0" });
await client.connect(transport);

let failures = 0;
const check = (l: string, c: boolean) => { console.log(`${c ? "✓" : "✗"} ${l}`); if (!c) failures++; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: any) => JSON.parse(r.content[0].text);

const tools = (await client.listTools()).tools;
check("list_spaces tool advertised", tools.some((t) => t.name === "list_spaces"));

const spaces = json(await client.callTool({ name: "list_spaces", arguments: {} }));
const personal = spaces.find((s: { isPersonal: boolean }) => s.isPersonal);
check("list_spaces returns the Personal space", Boolean(personal));

const created = json(await client.callTool({ name: "create_document", arguments: { space_id: personal.id, title: "MCP Spaces", content: "# MCP Spaces\n\nSemantic content about brewing coffee.\n" } }));
check("create_document with space_id", Boolean(created.id) && created.spaceId === personal.id);

const listed = json(await client.callTool({ name: "list_documents", arguments: { space_id: personal.id } }));
check("list_documents scoped to space", listed.some((d: { id: string }) => d.id === created.id));

const results = json(await client.callTool({ name: "search_documents", arguments: { space_id: personal.id, query: "making espresso" } }));
check("search_documents within space (semantic)", Array.isArray(results) && results.length >= 1);

await client.close();
await db.delete(documents).where(eq(documents.authorId, user.id));
for (const t of await tokens.list(user.id)) if (t.name === "mcp-spaces") await tokens.revoke(user.id, t.id);
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
