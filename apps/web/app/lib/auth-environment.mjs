export function authConfigurationStatus(env = process.env) {
  const databaseAdapter = (env.AUTH_DATABASE_PROVIDER || "postgres").trim().toLowerCase();
  const databaseUrl = env.DATABASE_URL || env.POSTGRES_URL || "";
  const postgresProviders = ["postgres", "postgresql", "supabase", "prisma-postgres", "neon", "vercel-postgres"];
  const supportedDatabaseProvider = [...postgresProviders, "none"].includes(databaseAdapter);
  const databaseConfigured = databaseAdapter === "none" || (
    postgresProviders.includes(databaseAdapter) &&
    typeof databaseUrl === "string" && /^postgres(?:ql)?:\/\//i.test(databaseUrl)
  );
  const port = Number(env.SMTP_PORT);
  let canonicalOrigin = false;
  try {
    const url = new URL(env.AUTH_URL || "");
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    canonicalOrigin = (url.protocol === "https:" || localHttp) && url.pathname === "/" && !url.search && !url.hash;
  } catch { /* Missing or invalid canonical auth origin. */ }

  const available = Boolean(
    databaseAdapter !== "none" && supportedDatabaseProvider && databaseConfigured &&
    typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32 &&
    canonicalOrigin &&
    env.SMTP_HOST && Number.isInteger(port) && port >= 1 && port <= 65535 &&
    env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM,
  );
  return { available, email: available, google: false, registration: available };
}
