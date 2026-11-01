const POSTGRES_PROVIDERS = new Set([
  "postgres",
  "postgresql",
  "supabase",
  "prisma-postgres",
  "neon",
  "vercel-postgres",
]);

export function databaseConfiguration(env = process.env) {
  const provider = (env.DATABASE_PROVIDER || env.AUTH_DATABASE_PROVIDER || "postgres").trim().toLowerCase();
  const url = typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";
  const postgres = POSTGRES_PROVIDERS.has(provider);
  const validUrl = /^postgres(?:ql)?:\/\//i.test(url);
  return {
    provider,
    url,
    postgres,
    configured: provider === "none" || (postgres && validUrl),
    enabled: postgres && validUrl,
  };
}
