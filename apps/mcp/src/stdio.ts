#!/usr/bin/env -S node --import tsx
import "./env.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { authenticate } from "./context.js";
import { buildMcpServer } from "./server.js";

// Local clients (Claude Code, Codex) authenticate with a PAT from the environment.
const token = process.env.AI_BRAIN_TOKEN ?? process.env.AIB_TOKEN;
const ctx = await authenticate(token);
if (!ctx) {
  console.error(
    "ai-brain MCP: missing or invalid token. Set AI_BRAIN_TOKEN to a PAT generated at /settings/tokens.",
  );
  process.exit(1);
}

const server = buildMcpServer(ctx);
await server.connect(new StdioServerTransport());
// stdout is the MCP channel — logs go to stderr.
console.error("ai-brain MCP server (stdio) ready");
