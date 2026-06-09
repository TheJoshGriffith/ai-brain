import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Single source of truth for env lives at the monorepo root, not apps/web.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source and transpiled by Next.
  transpilePackages: ["@ai-brain/core", "@ai-brain/db"],
  // Keep native/node-only deps out of the bundle (required at runtime instead).
  serverExternalPackages: [
    "pg",
    "@node-rs/argon2",
    "@xenova/transformers",
    "onnxruntime-node",
    "sharp",
  ],
  webpack(config, { isServer }) {
    if (isServer) {
      // Reached via the transpiled core package, so serverExternalPackages alone
      // won't externalise these — force it. argon2 is CJS (commonjs); transformers
      // is ESM-only, so it must be an `import`-type external (require() of ESM
      // throws on Node 20). Its native deps load at runtime from node_modules.
      config.externals.push({
        "@node-rs/argon2": "commonjs @node-rs/argon2",
        "@xenova/transformers": "import @xenova/transformers",
      });
    }
    return config;
  },
};

export default nextConfig;
