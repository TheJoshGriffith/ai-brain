# AI Brain

A self-hosted, web-first Markdown knowledge base that doubles as an **AI brain**. Documents
and the links between them are stored in Postgres and exposed over both a **REST API** and an
**MCP server**, so Claude, Codex, and other tooling can read, write, search, and traverse your
notes. A drop-in replacement for Obsidian, built AI-native from the ground up.

## Stack

| Layer        | Choice                                                            |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | Next.js (App Router) + Tailwind CSS v4                             |
| Backend      | TypeScript service layer shared by the web API and the MCP server |
| Database     | Postgres 16 + pgvector (Drizzle ORM)                              |
| Search       | Hybrid: Postgres full-text + pgvector semantic (RRF)              |
| Auth         | Auth.js credentials login + hashed Personal Access Tokens         |
| AI interface | MCP server (stdio + streamable HTTP) + REST, one shared core      |
| Deployment   | Docker Compose                                                    |

## Repository layout

```
apps/
  web/        Next.js app — UI, REST API, Auth.js
  mcp/        MCP server (added in Phase 6)
packages/
  core/       Domain/service layer (documents, links, search, embeddings, auth)
  db/         Drizzle schema, migrations, Postgres + pgvector client
infra/
  postgres/   First-boot init (enables the vector extension)
```

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env        # then edit AUTH_SECRET etc.

# 3. Start Postgres (with pgvector)
docker compose up -d db

# 4. Apply the schema
pnpm db:migrate

# 5. Run the app
pnpm dev                    # web on http://localhost:3000
```

## Connect Claude / Codex (MCP)

Generate a Personal Access Token at `/settings/tokens`, then point your client at the
MCP server. Tools exposed: `search_documents`, `list_documents`, `get_document`,
`create_document`, `update_document`, `delete_document`, `get_backlinks`, `list_links`,
plus a `brain://documents/{id}` resource.

**Local (stdio)** — e.g. Claude Code:

```bash
claude mcp add ai-brain \
  --env AI_BRAIN_TOKEN=<your-PAT> \
  -- node --import tsx /absolute/path/to/ai-brain/apps/mcp/src/stdio.ts
```

**Remote (Streamable HTTP)** — run `pnpm --filter @ai-brain/mcp start:http` (defaults to
`:8787`), then:

```bash
claude mcp add --transport http ai-brain http://localhost:8787/mcp \
  -H "Authorization: Bearer <your-PAT>"
```

## REST API

All endpoints accept `Authorization: Bearer <PAT>` (or a session cookie):

| Method | Path | Scope |
| --- | --- | --- |
| GET/POST | `/api/documents` | `documents:read` / `documents:write` |
| GET/PATCH/DELETE | `/api/documents/:id` | read / write |
| GET | `/api/documents/:id/backlinks` | `documents:read` |
| GET | `/api/search?q=` | `search:read` |

## Build phases — all complete ✅

1. **Scaffold** — monorepo, Next.js + Tailwind, Postgres + pgvector, base schema.
2. **Auth** — login + Personal Access Tokens.
3. **Documents** — CRUD, Markdown parsing, editor.
4. **Links** — `[[wiki-links]]` + backlinks.
5. **Search** — full-text + semantic (hybrid).
6. **MCP** — stdio + HTTP server over the service layer.

Each phase has a `verify-phaseN*.mts` script under `packages/core/scripts` (or
`apps/mcp/scripts`) demonstrating it end-to-end.

### Not yet done (follow-ups)
- Dockerfiles + Compose services for the web/MCP apps (Postgres is already containerised).
- Graph view, folders/workspaces, SSO, real-time collaboration.
