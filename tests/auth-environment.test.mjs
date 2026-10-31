import test from "node:test";
import assert from "node:assert/strict";
import { authConfigurationStatus } from "../apps/web/app/lib/auth-environment.mjs";

const configured = {
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  AUTH_URL: "https://tools.example.com",
  DATABASE_URL: "postgresql://user:password@db.example/celi_auth?sslmode=require",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user",
  SMTP_PASSWORD: "smtp-password",
  EMAIL_FROM: "Celi Tools <no-reply@example.com>",
};

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
});

test("auth status exposes no server secrets", () => {
  const status = authConfigurationStatus(configured);
  assert.equal(JSON.stringify(status).includes(configured.DATABASE_URL), false);
  assert.equal(JSON.stringify(status).includes(configured.SMTP_PASSWORD), false);
  assert.equal(status.google, false);
});
