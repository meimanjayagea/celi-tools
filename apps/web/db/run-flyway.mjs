import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { databaseConfiguration } from "../app/lib/database-config.mjs";
import { createFlywayEnvironment } from "./flyway-connection.mjs";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationDirectory = path.join(repositoryRoot, "apps/web/db/migrations");
const command = process.argv[2];
const allowedCommands = new Set(["info", "migrate", "baseline", "validate"]);
const legacyMigrations = [
  ["001_auth.sql", "V001__auth.sql"],
  ["002_sticky_notes.sql", "V002__sticky_notes.sql"],
  ["003_ai_agent.sql", "V003__ai_agent.sql"],
  ["004_ai_provider_fallback.sql", "V004__ai_provider_fallback.sql"],
];

async function verifyLegacyDatabase() {
  const database = databaseConfiguration();
  if (!database.enabled) throw new Error("DATABASE_URL belum dikonfigurasi untuk PostgreSQL.");

  const pool = new Pool({ connectionString: database.url, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const { rows: [state] } = await pool.query(`
      SELECT
        to_regclass('celi_meta.schema_migrations') IS NOT NULL AS legacy_ledger,
        to_regclass('celi_auth.users') IS NOT NULL AS auth_users,
        to_regclass('celi_auth.accounts') IS NOT NULL AS auth_accounts,
        to_regclass('celi_auth.sessions') IS NOT NULL AS auth_sessions,
        to_regclass('celi_app.sticky_notes') IS NOT NULL AS sticky_notes,
        to_regclass('celi_app.ai_provider_profiles') IS NOT NULL AS ai_profiles
    `);
    if (!state.legacy_ledger || !state.auth_users || !state.auth_accounts || !state.auth_sessions || !state.sticky_notes || !state.ai_profiles) {
      throw new Error("Skema database belum cocok dengan migrasi lama 001–004.");
    }

    const oldNames = legacyMigrations.map(([name]) => name);
    const { rows } = await pool.query(
      "SELECT name, checksum FROM celi_meta.schema_migrations WHERE name = ANY($1::text[])",
      [oldNames],
    );
    const recorded = new Map(rows.map(row => [row.name, row.checksum.trim()]));
    for (const [legacyName, currentName] of legacyMigrations) {
      const sql = await readFile(path.join(migrationDirectory, currentName), "utf8");
      const expectedChecksum = createHash("sha256").update(sql).digest("hex");
      if (recorded.get(legacyName) !== expectedChecksum) {
        throw new Error(`Ledger lama tidak memiliki checksum valid untuk ${legacyName}.`);
      }
    }
  } finally {
    await pool.end();
  }
}

if (!allowedCommands.has(command)) {
  console.error("Gunakan: npm run db:status | npm run db:migrate | npm run db:baseline:legacy | npm run db:validate");
  process.exitCode = 2;
} else {
  try {
    if (command === "baseline") await verifyLegacyDatabase();

    const env = { ...process.env, ...createFlywayEnvironment() };
    const result = spawnSync("flyway", ["-configFiles=apps/web/db/flyway.toml", command], {
      cwd: repositoryRoot,
      env,
      stdio: "inherit",
    });

    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    const action = command === "baseline" ? "Baseline lama ditolak" : "Flyway gagal dijalankan";
    console.error(`${action}: ${error.message}`);
    process.exitCode = 1;
  }
}
