import assert from "node:assert/strict";

const base = process.env.AUTH_TEST_URL || "http://localhost:3000";
for (const path of ["/login", "/register"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(/type="password"/.test(html), false);
  assert.equal(/Lanjutkan dengan Google/i.test(html), false);
  assert.match(html, path === "/login" ? /Selamat datang kembali/ : /Satu akun\. Banyak yang beres\./);
}

const response = await fetch(base + "/api/auth/status", { cache: "no-store" });
assert.ok([200, 503].includes(response.status));
const status = await response.json();
assert.deepEqual(Object.keys(status).sort(), ["available", "email", "google", "registration"]);
assert.ok(Object.values(status).every(value => typeof value === "boolean"));
assert.equal(status.google, false);
if (response.status === 503) assert.deepEqual(status, { available: false, email: false, google: false, registration: false });
console.log("Auth UI/status checks passed; no email was sent.");
