/**
 * Phase 6 verification: connect a real MCP client to the stdio server and
 * exercise the tools, scope enforcement, and invalid-token rejection.
 */
import "../src/env.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { closeDb, documents, getDb, users } from "@ai-brain/db";
import { TokenService } from "@ai-brain/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const stdioPath = resolve(here, "../src/stdio.ts");
const mcpDir = resolve(here, "..");

const db = getDb();
const user = await db.query.users.findFirst({ where: eq(users.email, "josh@example.com") });
if (!user) throw new Error("seed user missing");
await db.delete(documents).where(eq(documents.ownerId, user.id));
const tokens = new TokenService(db);
const full = (await tokens.create(user.id, { name: "mcp-full", scopes: ["documents:read", "documents:write", "search:read"] })).token;
const ro = (await tokens.create(user.id, { name: "mcp-ro", scopes: ["documents:read"] })).token;

let failures = 0;
const check = (label: string, cond: boolean) => { console.log(`${cond ? "✓" : "✗"} ${label}`); if (!cond) failures++; };

async function connect(token: string) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["--import", "tsx", stdioPath],
    cwd: mcpDir,
    env: { ...process.env, AI_BRAIN_TOKEN: token } as Record<string, string>,
  });
  const client = new Client({ name: "verify", version: "1.0.0" });
  await client.connect(transport);
  return client;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const text = (res: any) => res.content[0].text as string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (res: any) => JSON.parse(text(res));

const client = await connect(full);
const tools = (await client.listTools()).tools;
check("all 8 tools exposed", tools.length === 8);
check("search_documents is advertised", tools.some((t) => t.name === "search_documents"));

const note = json(await client.callTool({ name: "create_document", arguments: { title: "MCP Note", content: "# MCP Note\n\nReferences [[Roadmap]].\n" } }));
check("create_document returns a doc", Boolean(note.id));

const listed = json(await client.callTool({ name: "list_documents", arguments: {} }));
check("list_documents includes the new doc", listed.some((d: { id: string }) => d.id === note.id));

const got = json(await client.callTool({ name: "get_document", arguments: { id: note.id } }));
check("get_document returns full content", String(got.content).includes("References"));

const roadmap = json(await client.callTool({ name: "create_document", arguments: { title: "Roadmap", content: "# Roadmap\n" } }));
const backlinks = json(await client.callTool({ name: "get_backlinks", arguments: { id: roadmap.id } }));
check("get_backlinks finds the referencing note", backlinks.some((b: { documentId: string }) => b.documentId === note.id));

const links = json(await client.callTool({ name: "list_links", arguments: { id: note.id } }));
check("list_links shows the resolved link", links.some((l: { resolved: boolean }) => l.resolved));

const results = json(await client.callTool({ name: "search_documents", arguments: { query: "planning roadmap" } }));
check("search_documents returns results", Array.isArray(results) && results.length >= 1);

const deleted = json(await client.callTool({ name: "delete_document", arguments: { id: note.id } }));
check("delete_document works", deleted.deleted === true);

const resources = await client.listResources();
check("documents resource lists notes", resources.resources.some((r) => r.uri.startsWith("brain://documents/")));
await client.close();

// Scope enforcement
const roClient = await connect(ro);
const denied = await roClient.callTool({ name: "create_document", arguments: { content: "nope" } });
check("read-only token cannot create", denied.isError === true && text(denied).includes("scope"));
await roClient.close();

// Invalid token → server refuses, client fails to use it
let badFailed = false;
try {
  const bad = await connect("aib_invalid_token");
  await bad.listTools();
} catch {
  badFailed = true;
}
check("invalid token is rejected", badFailed);

await db.delete(documents).where(eq(documents.ownerId, user.id));
for (const t of await tokens.list(user.id)) if (t.name.startsWith("mcp-")) await tokens.revoke(user.id, t.id);
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
await closeDb();
process.exit(failures === 0 ? 0 : 1);
