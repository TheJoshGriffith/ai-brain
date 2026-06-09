import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source and transpiled by Next.
  transpilePackages: ["@ai-brain/core", "@ai-brain/db"],
  // Keep native/node-only deps out of the bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
