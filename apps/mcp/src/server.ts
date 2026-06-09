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
    "list_spaces",
    "List the spaces (workspaces) the user can access, with their role in each. Most tools require a space_id from here.",
    {},
    () => tool(ctx, "spaces:read", async () => ok(await ctx.spaces.list(ctx.userId)))(),
  );

  server.tool(
    "search_documents",
    "Hybrid full-text + semantic search within a space. Use this first to find relevant notes by keyword or meaning.",
    {
      space_id: z.string().describe("The space to search (from list_spaces)"),
      query: z.string().describe("Search query — keywords or a natural-language description"),
      limit: z.number().int().min(1).max(50).optional(),
    },
    ({ space_id, query, limit }) =>
      tool(ctx, "search:read", async () => ok(await ctx.search.search(ctx.userId, space_id, query, { limit })))(),
  );

  server.tool(
    "list_documents",
    "List documents in a space (most recently updated first).",
    {
      space_id: z.string().describe("The space to list (from list_spaces)"),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    ({ space_id, limit, offset }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.documents.list(ctx.userId, space_id, { limit, offset })))(),
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
    "Create a new Markdown document in a space. Title is derived from the content (frontmatter or first heading) if omitted. Use [[wiki links]] to reference other documents.",
    {
      space_id: z.string().describe("The space to create the document in (from list_spaces)"),
      title: z.string().optional(),
      content: z.string().optional(),
      slug: z.string().optional(),
    },
    ({ space_id, title, content, slug }) =>
      tool(ctx, "documents:write", async () => ok(await ctx.documents.create(ctx.userId, space_id, { title, content: content ?? "", slug })))(),
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
    "reindex_document",
    "Queue a rebuild of a document's embeddings (e.g. after a bulk edit). Indexing runs asynchronously.",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:write", async () => {
        await ctx.documents.requestReindex(ctx.userId, id);
        return ok({ queued: true });
      })(),
  );

  server.tool(
    "list_versions",
    "List a document's version history (newest first).",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.documents.listVersions(ctx.userId, id)))(),
  );

  server.tool(
    "restore_version",
    "Restore a document to a prior version number (from list_versions). Creates a new version.",
    { id: z.string(), version: z.number().int() },
    ({ id, version }) =>
      tool(ctx, "documents:write", async () => ok(await ctx.documents.restoreVersion(ctx.userId, id, version)))(),
  );

  server.tool(
    "list_links",
    "List the outgoing [[wiki links]] from a document, with their resolution status.",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.links.outboundLinks(id)))(),
  );

  server.tool(
    "list_tags",
    "List the tags defined in a space.",
    { space_id: z.string() },
    ({ space_id }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.tags.listForSpace(ctx.userId, space_id)))(),
  );

  server.tool(
    "set_document_tags",
    "Replace a document's tags with the given list. Tags are created in the document's space as needed.",
    { id: z.string(), tags: z.array(z.string()) },
    ({ id, tags }) =>
      tool(ctx, "documents:write", async () => ok({ tags: await ctx.tags.setDocumentTags(ctx.userId, id, tags) }))(),
  );

  server.tool(
    "list_comments",
    "List the comments on a document.",
    { id: z.string() },
    ({ id }) =>
      tool(ctx, "documents:read", async () => ok(await ctx.comments.list(ctx.userId, id)))(),
  );

  server.tool(
    "add_comment",
    "Add a comment to a document (requires commenter access or above).",
    { id: z.string(), body: z.string() },
    ({ id, body }) =>
      tool(ctx, "documents:write", async () => ok(await ctx.comments.add(ctx.userId, id, { body })))(),
  );

  // Resource: browse/read documents by URI (brain://documents/{id}).
  server.resource(
    "documents",
    new ResourceTemplate("brain://documents/{id}", {
      list: async () => {
        const spaces = await ctx.spaces.list(ctx.userId);
        const perSpace = await Promise.all(
          spaces.map((s) =>
            ctx.documents.list(ctx.userId, s.id, { limit: 200 }).then((docs) =>
              docs.map((d) => ({
                uri: `brain://documents/${d.id}`,
                name: `${s.name} / ${d.title}`,
                mimeType: "text/markdown",
              })),
            ),
          ),
        );
        return { resources: perSpace.flat() };
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
