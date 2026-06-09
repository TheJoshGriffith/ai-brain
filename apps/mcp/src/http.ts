import "./env.js";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { parseBearer } from "@ai-brain/core";
import { authenticate } from "./context.js";
import { buildMcpServer } from "./server.js";

const port = Number(process.env.MCP_HTTP_PORT ?? 8787);

/**
 * Stateless Streamable-HTTP MCP endpoint at POST /mcp. Each request is
 * authenticated by its `Authorization: Bearer <PAT>` header and served by a
 * fresh server instance scoped to that token — safe for remote/multi-user.
 */
const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const ctx = await authenticate(parseBearer(req.headers.authorization) ?? undefined);
  if (!ctx) {
    res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;

  const server = buildMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
});

httpServer.listen(port, () => {
  console.error(`ai-brain MCP server (http) listening on http://localhost:${port}/mcp`);
});
