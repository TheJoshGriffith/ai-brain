import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DocumentNotFoundError } from "@ai-brain/core";
import { requireScope, type McpContext } from "./context.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: `Error: ${message}` }],
  isError: true,
});

/** Wraps a handler with scope enforcement and uniform error reporting. */
function tool(ctx: McpContext, scope: Parameters<typeof requireScope>[1], fn: () => Promise<ToolResult>) {
  return async (): Promise<ToolResult> => {
    try {
      requireScope(ctx, scope);
      return await fn();
    } catch (error) {
      if (error instanceof DocumentNotFoundError) return fail("Document not found");
      return fail(error instanceof Error ? error.message : String(error));
    }
  };
}

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({ name: "ai-brain", version: "0.1.0" });

  server.tool(
    "search_documents",
    "Hybrid full-text + semantic search across the user's documents. Use this first to find relevant notes by keyword or meaning.",
    { query: z.string().describe("Search query — keywords or a natural-language description"), limit: z.number().int().min(1).max(50).optional() },
    ({ query, limit }) =>
      tool(ctx, "search:read", async () => ok(await ctx.search.search(ctx.userId, query, { limit })))(),
  );

  server.tool(
    "list_documents",
    "List the user's documents (most recently updated first).",
    { limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() },
    ({ limit, offset }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.documents.list(ctx.userId, { limit, offset })))(),
  );

  server.tool(
    "get_document",
    "Fetch a single document (including its full Markdown content) by id.",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:read", async () => {
        const doc = await ctx.documents.get(ctx.userId, id);
        return doc ? ok(doc) : fail("Document not found");
      })(),
  );

  server.tool(
    "create_document",
    "Create a new Markdown document. Title is derived from the content (frontmatter or first heading) if omitted. Use [[wiki links]] to reference other documents.",
    { title: z.string().optional(), content: z.string().optional(), slug: z.string().optional() },
    ({ title, content, slug }) =>
      tool(ctx, "documents:write", async () => ok(await ctx.documents.create(ctx.userId, { title, content: content ?? "", slug })))(),
  );

  server.tool(
    "update_document",
    "Update a document's title, content, and/or slug. Links and embeddings are re-indexed automatically.",
    { id: z.string(), title: z.string().optional(), content: z.string().optional(), slug: z.string().optional() },
    ({ id, title, content, slug }) =>
      tool(ctx, "documents:write", async () => ok(await ctx.documents.update(ctx.userId, id, { title, content, slug })))(),
  );

  server.tool(
    "delete_document",
    "Permanently delete a document by id.",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:write", async () => {
        const deleted = await ctx.documents.remove(ctx.userId, id);
        return deleted ? ok({ deleted: true, id }) : fail("Document not found");
      })(),
  );

  server.tool(
    "get_backlinks",
    "List documents that link TO the given document (incoming references).",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.documents.backlinks(ctx.userId, id)))(),
  );

  server.tool(
    "list_links",
    "List the outgoing [[wiki links]] from a document, with their resolution status.",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.links.outboundLinks(id)))(),
  );

  // Resource: browse/read documents by URI (brain://documents/{id}).
  server.resource(
    "documents",
    new ResourceTemplate("brain://documents/{id}", {
      list: async () => {
        const docs = await ctx.documents.list(ctx.userId, { limit: 200 });
        return {
          resources: docs.map((d) => ({
            uri: `brain://documents/${d.id}`,
            name: d.title,
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    async (uri, { id }) => {
      const doc = await ctx.documents.get(ctx.userId, String(id));
      if (!doc) throw new Error("Document not found");
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: doc.content }] };
    },
  );

  return server;
}
