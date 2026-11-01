import test from "node:test";
import assert from "node:assert/strict";
import { authConfigurationStatus } from "../apps/web/app/lib/auth-environment.mjs";

const configured = {
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  AUTH_URL: "https://tools.example.com",
  DATABASE_URL: "postgresql://user:password@db.example/celi_auth?sslmode=require",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user",
  SMTP_PASSWORD: "smtp-password",
  EMAIL_FROM: "Celi Tools <no-reply@example.com>",
};
const withoutSmtp = env => Object.fromEntries(
  Object.entries(env).filter(([key]) => !["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"].includes(key)),
);

test("email auth reports ready only when all server configuration is valid", () => {
  assert.deepEqual(authConfigurationStatus({}), {
    available: false, email: false, google: false, registration: false,
  });
  assert.deepEqual(authConfigurationStatus(configured), {
    available: true, email: true, google: false, registration: true,
  });
});

test("email auth rejects invalid origins, weak secrets, and invalid SMTP ports", () => {
  for (const [name, value] of [
    ["AUTH_URL", "https://tools.example.com/path"],
    ["AUTH_URL", "http://tools.example.com"],
    ["AUTH_SECRET", "short"],
    ["SMTP_PORT", "70000"],
    ["DATABASE_URL", "https://database.example"],
  ]) {
    assert.equal(authConfigurationStatus({ ...configured, [name]: value }).available, false, name);
  }
  assert.equal(authConfigurationStatus({ ...configured, SMTP_HOST: "smtp.example.com" }).email, false);
});

test("Google OAuth can enable auth without SMTP credentials", () => {
  const base = withoutSmtp(configured);
  const status = authConfigurationStatus({
    ...base,
    GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "client-secret",
  });
  assert.deepEqual(status, { available: true, email: false, google: true, registration: true });
});

test("Google OAuth is unavailable until both OAuth credentials are configured", () => {
  const base = withoutSmtp(configured);
  for (const env of [
    { GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com" },
    { GOOGLE_CLIENT_SECRET: "client-secret" },
    { GOOGLE_CLIENT_ID: "replace-with-client-id", GOOGLE_CLIENT_SECRET: "client-secret" },
  ]) {
    assert.deepEqual(authConfigurationStatus({ ...base, ...env }), {
      available: false, email: false, google: false, registration: false,
    });
  }
});

test("auth status exposes no server secrets", () => {
  const status = authConfigurationStatus(configured);
  assert.equal(JSON.stringify(status).includes(configured.DATABASE_URL), false);
  assert.equal(JSON.stringify(status).includes(configured.SMTP_PASSWORD), false);
  assert.equal(status.google, false);
});
