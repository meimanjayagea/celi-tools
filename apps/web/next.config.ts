import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@celi/file-tools"],
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingExcludes: {
    "/*": [path.join(monorepoRoot, ".file-tools/**/*"), path.join(monorepoRoot, "test-output/**/*"), "../api/**/*"],
  },
  turbopack: {
    root: monorepoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
