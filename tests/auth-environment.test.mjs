import test from "node:test";
import assert from "node:assert/strict";
import { authConfigurationStatus } from "../apps/web/app/lib/auth-environment.mjs";
import { databaseConfiguration } from "../apps/web/app/lib/database-config.mjs";

const configured = {
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  AUTH_URL: "https://tools.example.com",
  DATABASE_URL: "postgresql://user:password@db.example/celi_auth?sslmode=require",
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
};

test("Google OAuth is the only supported sign-in and registration provider", () => {
  assert.deepEqual(authConfigurationStatus({}), {
    available: false, email: false, google: false, registration: false,
  });
  assert.deepEqual(authConfigurationStatus(configured), {
    available: true, email: false, google: true, registration: true,
  });
});

test("Google OAuth stays unavailable without database, origin, secret, or both OAuth credentials", () => {
  const withoutGoogle = { ...configured, GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined };
  for (const env of [
    { DATABASE_URL: "https://database.example" },
    { AUTH_URL: "https://tools.example.com/path" },
    { AUTH_URL: "http://tools.example.com" },
    { AUTH_SECRET: "short" },
    { GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com" },
    { GOOGLE_CLIENT_SECRET: "google-client-secret" },
    { GOOGLE_CLIENT_ID: "replace-with-client-id", GOOGLE_CLIENT_SECRET: "google-client-secret" },
  ]) {
    assert.deepEqual(authConfigurationStatus({ ...withoutGoogle, ...env }), {
      available: false, email: false, google: false, registration: false,
    });
  }
});

test("SMTP settings cannot enable a second email sign-in path", () => {
  assert.deepEqual(authConfigurationStatus({
    ...configured,
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "587",
    SMTP_USER: "smtp-user",
    SMTP_PASSWORD: "smtp-password",
    EMAIL_FROM: "Celi Tools <no-reply@example.com>",
  }), { available: false, email: false, google: false, registration: false });
});

test("auth status exposes no server secrets", () => {
  const status = authConfigurationStatus(configured);
  const serialized = JSON.stringify(status);
  assert.equal(serialized.includes(configured.DATABASE_URL), false);
  assert.equal(serialized.includes(configured.GOOGLE_CLIENT_SECRET), false);
  assert.equal(status.email, false);
});

test("database connection URLs spell out the driver's current secure SSL behavior without deprecation warnings", () => {
  const normalized = databaseConfiguration({ DATABASE_URL: "postgresql://user:secret@db.example/app?sslmode=require&application_name=celi" });
  assert.equal(new URL(normalized.url).searchParams.get("sslmode"), "verify-full");
  assert.equal(new URL(normalized.url).searchParams.get("application_name"), "celi");
  assert.equal(new URL(databaseConfiguration({ DATABASE_URL: "postgres://user:secret@db.example/app?sslmode=verify-full" }).url).searchParams.get("sslmode"), "verify-full");
  assert.equal(new URL(databaseConfiguration({ DATABASE_URL: "postgres://user:secret@db.example/app?sslmode=require&uselibpqcompat=true" }).url).searchParams.get("sslmode"), "require");
  assert.equal(new URL(databaseConfiguration({ DATABASE_URL: "postgres://user:secret@db.example/app?sslmode=disable" }).url).searchParams.get("sslmode"), "disable");
});
