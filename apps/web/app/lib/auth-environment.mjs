export function authConfigurationStatus(env = process.env) {
  const port = Number(env.SMTP_PORT);
  let canonicalOrigin = false;
  try {
    const url = new URL(env.AUTH_URL || "");
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    canonicalOrigin = (url.protocol === "https:" || localHttp) && url.pathname === "/" && !url.search && !url.hash;
  } catch { /* Missing or invalid canonical auth origin. */ }

  const available = Boolean(
    typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32 &&
    canonicalOrigin &&
    typeof env.DATABASE_URL === "string" && /^postgres(?:ql)?:\/\//i.test(env.DATABASE_URL) &&
    env.SMTP_HOST && Number.isInteger(port) && port >= 1 && port <= 65535 &&
    env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM,
  );
  return { available, email: available, google: false, registration: available };
}
