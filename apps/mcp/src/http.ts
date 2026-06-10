import "./env.js";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { parseBearer } from "@ai-brain/core";
import { authenticate } from "./context.js";
import { buildMcpServer } from "./server.js";

const port = Number(process.env.MCP_HTTP_PORT ?? 8787);
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB — cap to avoid memory exhaustion

const sendJson = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
};

/**
 * Stateless Streamable-HTTP MCP endpoint at POST /mcp. Each request is
 * authenticated by its `Authorization: Bearer <PAT>` header and served by a
 * fresh server instance scoped to that token — safe for remote/multi-user.
 */
const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (url.pathname !== "/mcp") return sendJson(res, 404, { error: "Not found" });

    const ctx = await authenticate(parseBearer(req.headers.authorization) ?? undefined);
    if (!ctx) return sendJson(res, 401, { error: "Unauthorized" });

    // Read the body with a hard size cap so a large request can't exhaust memory.
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        return sendJson(res, 413, { error: "Request body too large" });
      }
      chunks.push(chunk as Buffer);
    }

    let body: unknown;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON body" });
    }

    const server = buildMcpServer(ctx);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error("[mcp] request failed:", error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

httpServer.listen(port, () => {
  console.error(`ai-brain MCP server (http) listening on http://localhost:${port}/mcp`);
});
