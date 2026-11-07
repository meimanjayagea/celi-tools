import test from "node:test";
import assert from "node:assert/strict";
import { createFlywayEnvironment } from "../apps/web/db/flyway-connection.mjs";

test("converts a PostgreSQL DATABASE_URL to Flyway JDBC settings without exposing credentials in the URL", () => {
  const config = createFlywayEnvironment({
    DATABASE_PROVIDER: "postgres",
    DATABASE_URL: "postgresql://app%40celi:secret%21@db.example.com:5432/celi?sslmode=require&connect_timeout=10",
  });

  assert.deepEqual(config, {
    FLYWAY_URL: "jdbc:postgresql://db.example.com:5432/celi?sslmode=verify-full&connect_timeout=10",
    FLYWAY_USER: "app@celi",
    FLYWAY_PASSWORD: "secret!",
  });
});

test("keeps local PostgreSQL connections usable without forcing TLS", () => {
  const config = createFlywayEnvironment({
    DATABASE_PROVIDER: "postgres",
    DATABASE_URL: "postgres://local:local@localhost:5432/celi",
  });

  assert.equal(config.FLYWAY_URL, "jdbc:postgresql://localhost:5432/celi");
});

test("rejects non-PostgreSQL database providers and malformed direct JDBC URLs", () => {
  assert.throws(() => createFlywayEnvironment({ DATABASE_PROVIDER: "none" }), /PostgreSQL/);
  assert.throws(() => createFlywayEnvironment({ FLYWAY_URL: "postgres://db.example.com/celi" }), /jdbc:postgresql/);
});
