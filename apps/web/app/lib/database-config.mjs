const POSTGRES_PROVIDERS = new Set([
  "postgres",
  "postgresql",
  "supabase",
  "prisma-postgres",
  "neon",
  "vercel-postgres",
]);

function explicitSecureSslMode(value) {
  try {
    const url = new URL(value);
    const mode = url.searchParams.get("sslmode");
    if (url.searchParams.get("uselibpqcompat") !== "true" && ["prefer", "require", "verify-ca"].includes(mode)) {
      // pg-connection-string currently treats these modes as verify-full unless libpq compatibility is requested.
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function databaseConfiguration(env = process.env) {
  const provider = (env.DATABASE_PROVIDER || env.AUTH_DATABASE_PROVIDER || "postgres").trim().toLowerCase();
  const url = typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";
  const postgres = POSTGRES_PROVIDERS.has(provider);
  const validUrl = /^postgres(?:ql)?:\/\//i.test(url);
  return {
    provider,
    url: postgres && validUrl ? explicitSecureSslMode(url) : url,
    postgres,
    configured: provider === "none" || (postgres && validUrl),
    enabled: postgres && validUrl,
  };
}
