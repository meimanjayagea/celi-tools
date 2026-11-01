import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { databaseConfiguration } from "../app/lib/database-config.mjs";

const migrationDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));
const command = process.argv[2];
const ledger = "celi_meta.schema_migrations";
const lockKeys = [74122361, 20311244];

async function loadMigrations() {
  const filenames = (await readdir(migrationDirectory)).filter(name => name.endsWith(".sql")).sort();
  const migrations = [];
  for (const filename of filenames) {
    const match = /^(\d{3})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/.exec(filename);
    if (!match) throw new Error(`Nama migrasi tidak valid: ${filename}`);
    const expectedSequence = String(migrations.length + 1).padStart(3, "0");
    if (match[1] !== expectedSequence) {
      throw new Error(`Urutan migrasi harus berkelanjutan; diharapkan ${expectedSequence}, ditemukan ${match[1]}.`);
    }
    const sql = await readFile(path.join(migrationDirectory, filename), "utf8");
    if (!sql.trim()) throw new Error(`Migrasi kosong: ${filename}`);
    migrations.push({
      name: filename,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  if (!migrations.length) throw new Error(`Tidak ada file .sql di ${migrationDirectory}`);
  return migrations;
}

function printUsage() {
  console.error("Gunakan: npm run db:list | npm run db:status | npm run db:migrate");
}

function getPool() {
  const config = databaseConfiguration();
  if (!config.configured || !config.enabled) {
    throw new Error("DATABASE_PROVIDER harus menunjuk ke PostgreSQL dan DATABASE_URL harus berupa URL PostgreSQL.");
  }
  return new Pool({ connectionString: config.url, max: 1, connectionTimeoutMillis: 5_000 });
}

async function readApplied(client, migrations) {
  const { rows: [state] } = await client.query("SELECT to_regclass($1) IS NOT NULL AS ledger_exists", [ledger]);
  if (!state.ledger_exists) return new Map();

  const { rows } = await client.query(`SELECT name, checksum FROM ${ledger} ORDER BY name`);
  const known = new Set(migrations.map(migration => migration.name));
  const applied = new Map();
  for (const row of rows) {
    if (!known.has(row.name)) throw new Error(`Migrasi yang sudah tercatat tidak ada di repository: ${row.name}`);
    applied.set(row.name, row.checksum);
  }
  return applied;
}

function verifyChecksums(migrations, applied) {
  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.name);
    if (appliedChecksum && appliedChecksum !== migration.checksum) {
      throw new Error(`Checksum ${migration.name} berubah setelah diterapkan. Jangan mengedit migrasi lama; buat migrasi baru.`);
    }
  }
}

async function main() {
  if (!["--list", "--status", "--apply"].includes(command)) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const migrations = await loadMigrations();
  if (command === "--list") {
    migrations.forEach(migration => console.log(migration.name));
    return;
  }

  const pool = getPool();
  let client;
  let locked = false;
  try {
    client = await pool.connect();
    if (command === "--apply") {
      await client.query("SELECT pg_advisory_lock($1, $2)", lockKeys);
      locked = true;
      await client.query("CREATE SCHEMA IF NOT EXISTS celi_auth");
      await client.query("CREATE SCHEMA IF NOT EXISTS celi_meta");
      await client.query(`CREATE TABLE IF NOT EXISTS ${ledger} (
        name text PRIMARY KEY,
        checksum char(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    }

    const applied = await readApplied(client, migrations);
    verifyChecksums(migrations, applied);

    if (command === "--status") {
      for (const migration of migrations) {
        console.log(`${applied.has(migration.name) ? "APPLIED" : "PENDING"} ${migration.name}`);
      }
      return;
    }

    let count = 0;
    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        console.log(`SKIP ${migration.name}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(`INSERT INTO ${ledger} (name, checksum) VALUES ($1, $2)`, [migration.name, migration.checksum]);
        await client.query("COMMIT");
        count++;
        console.log(`APPLIED ${migration.name}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
    console.log(count ? `Applied ${count} migration(s).` : "Database schema is already up to date.");
  } finally {
    if (locked && client) await client.query("SELECT pg_advisory_unlock($1, $2)", lockKeys).catch(() => {});
    client?.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});
