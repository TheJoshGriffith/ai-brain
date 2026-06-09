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

## Build phases

1. **Scaffold** — monorepo, Next.js + Tailwind, Postgres + pgvector, base schema. ← current
2. **Auth** — login + Personal Access Tokens.
3. **Documents** — CRUD, Markdown parsing, editor.
4. **Links** — `[[wiki-links]]` + backlinks.
5. **Search** — full-text + semantic (hybrid).
6. **MCP** — stdio + HTTP server over the service layer.
