import "server-only";
import { Pool } from "pg";
import { databaseConfiguration } from "./database-config.mjs";

const globalForDatabase = globalThis as typeof globalThis & { celiDatabasePool?: Pool };
const config = databaseConfiguration();

/** One server-side PostgreSQL pool shared by Auth.js and application repositories. */
export const pool = config.enabled
  ? globalForDatabase.celiDatabasePool ?? new Pool({
      connectionString: config.url,
      options: "-c search_path=celi_auth",
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    })
  : undefined;

if (pool && process.env.NODE_ENV !== "production") globalForDatabase.celiDatabasePool = pool;

export const databaseReady = Boolean(pool);
