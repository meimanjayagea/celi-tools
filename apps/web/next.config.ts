import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig: NextConfig = {
  // Explicitly publish only browser configuration. Deployment variable names do
  // not need NEXT_PUBLIC_; these three values still ship in the browser bundle.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
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
