# Deploying ai-brain on Unraid

The published GHCR image (`ghcr.io/thejoshgriffith/ai-brain`) is self-contained:
the whole monorepo + pnpm live inside it, and each service is just that one image
run with a different command (`web`, `mcp`, `worker`, and a one-shot `migrate`).
**You do not need a Dockerfile or any build step on Unraid** — only the prebuilt
image plus three small files in appdata.

## What lives where

```
/mnt/user/appdata/ai-brain/
├── ai-brain.env        # secrets + config, loaded into every container (chmod 600)
├── init/init.sql       # enables pgvector on first DB init
├── postgres/           # Postgres data
└── models/             # embedding-model cache (downloaded once, ~120 MB)
```

`docker-compose.yml` references those paths directly — no project-level `.env`
or `${VAR}` interpolation, which is the usual Compose-Manager footgun.

## One-time setup (run on the Unraid host, as root)

```bash
mkdir -p /boot/config/plugins/compose.manager/projects/ai-brain
cd /boot/config/plugins/compose.manager/projects/ai-brain

# Fetch the two files from the public repo
curl -fsSLO https://raw.githubusercontent.com/TheJoshGriffith/ai-brain/master/infra/unraid/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/TheJoshGriffith/ai-brain/master/infra/unraid/setup-unraid.sh -o setup-unraid.sh

# Create appdata, generate secrets, write init.sql + ai-brain.env
bash setup-unraid.sh

# IMPORTANT: set AUTH_URL to exactly how you browse to the app
nano /mnt/user/appdata/ai-brain/ai-brain.env     # edit AUTH_URL if not http://<ip>:3002

# Bring it up
docker compose up -d
```

In the Unraid GUI you can instead use **Docker → Compose Manager → Add Stack**,
name it `ai-brain`, paste `docker-compose.yml`, then **Compose Up**. (Run
`setup-unraid.sh` once first so the appdata files exist.)

## After it's up

- Web UI: `http://<unraid-ip>:3002` — the **first account you register becomes admin**.
- MCP endpoint for Claude/Codex: `http://<unraid-ip>:8787` (authenticate with a PAT
  from **Settings → Tokens**).
- `migrate` runs once and exits `0` — that's expected, not a crash.

## Notes

- **AUTH_URL must match the URL you actually use.** Auth.js builds login callbacks
  from it; a mismatch (wrong port, or hitting it through a reverse proxy under a
  different hostname) breaks sign-in. Behind SWAG/NPM, set it to the public
  `https://...` origin.
- **Updating:** `docker compose pull && docker compose up -d` re-pulls `:master`
  and restarts. Pin `:v1.x.x` in the compose once you cut tagged releases.
- **Backups:** the whole `/mnt/user/appdata/ai-brain` folder is your state — back
  it up (or `pg_dump` the `postgres/` data) with the Unraid Appdata Backup plugin.
- **Postgres port** is internal by default; uncomment the `db` `ports:` block only
  if you want to reach it from the LAN.
