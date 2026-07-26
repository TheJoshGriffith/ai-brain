# Single image for the whole monorepo; compose runs web / mcp / worker / migrate
# off it with different commands. Simpler + more reliable than per-app standalone
# builds given the native deps (argon2, transformers/onnxruntime, sharp, pg).
FROM node:20-bookworm-slim AS app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# git: required for pnpm to fetch github:-hosted dependencies (tibiamap plugin).
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY . .

# Install all workspace deps (incl. native prebuilds) and build the web app.
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgres://placeholder AUTH_SECRET=placeholder pnpm --filter @ai-brain/web build

ENV NODE_ENV=production
ENV MODEL_CACHE_DIR=/app/.models

# Run unprivileged. uid 99 / gid 100 == Unraid's nobody:users, so bind-mounted
# appdata dirs (which setup-unraid.sh already chowns to 99:100) stay writable
# without any re-chowning. Only the paths written at runtime need ownership:
# the model cache and Next's runtime cache. node_modules stays root-owned (RO).
RUN (useradd -u 99 -g 100 -m -d /home/app -s /usr/sbin/nologin app 2>/dev/null || true) \
 && mkdir -p /home/app /app/.models \
 && chown -R 99:100 /home/app /app/.models /app/apps/web/.next
ENV HOME=/home/app
USER 99:100

EXPOSE 3002 8787

# Default command (overridden per service in docker-compose).
CMD ["pnpm", "--filter", "@ai-brain/web", "start"]
