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

  const baseConfigurationReady = Boolean(
    databaseAdapter !== "none" && supportedDatabaseProvider && databaseConfigured &&
    typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32 && canonicalOrigin,
  );
  const smtpHost = typeof env.SMTP_HOST === "string" ? env.SMTP_HOST.trim().toLowerCase() : "";
  const email = Boolean(
    smtpHost && !/(^|\.)example\.(com|net|org)$/.test(smtpHost) &&
    Number.isInteger(port) && port >= 1 && port <= 65535 &&
    env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM,
  );
  const googleClientId = typeof env.GOOGLE_CLIENT_ID === "string" ? env.GOOGLE_CLIENT_ID.trim() : "";
  const googleClientSecret = typeof env.GOOGLE_CLIENT_SECRET === "string" ? env.GOOGLE_CLIENT_SECRET.trim() : "";
  const google = Boolean(
    /^[\w-]+\.apps\.googleusercontent\.com$/.test(googleClientId) && googleClientSecret &&
    !/^(replace-|your-|placeholder)/i.test(googleClientId) &&
    !/^(replace-|your-|placeholder)/i.test(googleClientSecret),
  );
  const available = baseConfigurationReady && (email || google);
  return { available, email: baseConfigurationReady && email, google: baseConfigurationReady && google, registration: available };
}
