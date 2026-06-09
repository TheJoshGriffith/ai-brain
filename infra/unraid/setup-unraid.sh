#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# ai-brain — Unraid appdata bootstrap.
#
# Creates the appdata tree, the Postgres init script, and a secrets-filled
# env file that every container loads. Safe to re-run: it will NOT overwrite
# an existing ai-brain.env (your secrets are preserved).
#
# Usage (as root on the Unraid host):
#   ./setup-unraid.sh
#
# Optional overrides:
#   APPDATA=/mnt/user/appdata/ai-brain   # where to put data (must match compose)
#   PUID=99 PGID=100                      # Unraid nobody:users
#   WEB_PORT=3002                         # used only to seed AUTH_URL
# ---------------------------------------------------------------------------

APPDATA="${APPDATA:-/mnt/user/appdata/ai-brain}"
ENV_FILE="$APPDATA/ai-brain.env"
PUID="${PUID:-99}"
PGID="${PGID:-100}"
WEB_PORT="${WEB_PORT:-3002}"

echo "==> Creating appdata tree under $APPDATA"
mkdir -p "$APPDATA/postgres" "$APPDATA/models"
# (pgvector is enabled by the first DB migration, so no init script is needed.)

if [[ -f "$ENV_FILE" ]]; then
  echo "==> $ENV_FILE already exists — leaving it untouched (preserving secrets)."
else
  echo "==> Generating secrets + $ENV_FILE"
  AUTH_SECRET="$(openssl rand -base64 32)"
  PG_PASS="$(openssl rand -hex 24)"   # hex keeps it URL-safe inside DATABASE_URL
  HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  HOST_IP="${HOST_IP:-YOUR_UNRAID_IP}"

  cat > "$ENV_FILE" <<EOF
# ---- ai-brain runtime config (loaded into every container via env_file) ----
# Delete this file and re-run setup-unraid.sh to regenerate the secrets.

# Postgres
POSTGRES_USER=ai_brain
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=ai_brain

# App DB connection — password MUST match POSTGRES_PASSWORD above.
DATABASE_URL=postgres://ai_brain:$PG_PASS@db:5432/ai_brain

# Auth.js — AUTH_URL must be the exact URL you browse to (proxy/hostname aware).
AUTH_SECRET=$AUTH_SECRET
AUTH_URL=http://$HOST_IP:$WEB_PORT

# Embeddings (local = in-process, no API key; model is cached under ./models)
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
MODEL_CACHE_DIR=/app/.models

# Background worker
TRASH_RETENTION_DAYS=30

# Email — blank SMTP_HOST logs reset/verify links to the container logs.
REQUIRE_EMAIL_VERIFICATION=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=AI Brain <no-reply@ai-brain.local>

# MCP server (streamable HTTP)
MCP_HTTP_PORT=8787
EOF
  chmod 600 "$ENV_FILE"
  echo "    AUTH_URL seeded as http://$HOST_IP:$WEB_PORT"
  echo "    -> edit $ENV_FILE if you front it with a reverse proxy or hostname."
fi

echo "==> Setting ownership to $PUID:$PGID (Postgres re-owns its data dir itself)"
chown -R "$PUID:$PGID" "$APPDATA/models" 2>/dev/null || true
chown "$PUID:$PGID" "$ENV_FILE" 2>/dev/null || true

cat <<EOF

✅ Appdata ready at $APPDATA
   ├── ai-brain.env        (secrets + config — keep private)
   ├── postgres/           (database files)
   └── models/             (embedding model cache, downloaded once)

Next steps:
  1. Ensure the GHCR package is public, OR authenticate the Unraid host:
       docker login ghcr.io -u <github-user> -p <PAT-with-read:packages>
  2. Compose Manager → Add Stack → paste docker-compose.yml → Compose Up.
       (Or from CLI in this folder: docker compose up -d)
  3. Open  http://$( hostname -I 2>/dev/null | awk '{print $1}' ):$WEB_PORT
       The first account you register becomes the admin.
  4. MCP endpoint for Claude/Codex:  http://<unraid-ip>:8787  (use a PAT from Settings → Tokens)
EOF
