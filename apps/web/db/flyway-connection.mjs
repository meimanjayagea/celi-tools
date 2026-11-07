import { databaseConfiguration } from "../app/lib/database-config.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function createFlywayEnvironment(env = process.env) {
  if (env.FLYWAY_URL) {
    if (!env.FLYWAY_URL.startsWith("jdbc:postgresql://")) {
      throw new Error("FLYWAY_URL harus menggunakan format jdbc:postgresql://.");
    }
    return {
      FLYWAY_URL: env.FLYWAY_URL,
      FLYWAY_USER: env.FLYWAY_USER || "",
      FLYWAY_PASSWORD: env.FLYWAY_PASSWORD || "",
    };
  }

  const config = databaseConfiguration(env);
  if (!config.enabled) {
    throw new Error("DATABASE_PROVIDER harus menunjuk ke PostgreSQL dan DATABASE_URL harus berupa URL PostgreSQL.");
  }

  const databaseUrl = new URL(config.url);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL harus menggunakan skema postgres:// atau postgresql://.");
  }

  if (!databaseUrl.searchParams.has("sslmode") && !LOCAL_HOSTS.has(databaseUrl.hostname)) {
    databaseUrl.searchParams.set("sslmode", "require");
  }

  return {
    FLYWAY_URL: `jdbc:postgresql://${databaseUrl.host}${databaseUrl.pathname}${databaseUrl.search}`,
    FLYWAY_USER: decodeURIComponent(databaseUrl.username),
    FLYWAY_PASSWORD: decodeURIComponent(databaseUrl.password),
  };
}
