import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig: NextConfig = {
  // Only the file API URL is public; auth secrets stay on the server.
  env: {
    NEXT_PUBLIC_FILE_API_URL: process.env.FILE_API_URL || process.env.NEXT_PUBLIC_FILE_API_URL || "",
  },
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
