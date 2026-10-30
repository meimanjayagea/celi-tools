import assert from "node:assert/strict";
const base = process.env.AUTH_TEST_URL || "http://localhost:3000";
for (const [path, destination] of [
  ["/auth/callback", "/login?auth_error=invalid_link"],
  ["/auth/callback?error=access_denied&flow=register&next=//evil.example&error_description=secret", "/register?auth_error=oauth_cancelled"],
  ["/auth/confirm?token_hash=synthetic&type=recovery", "/login?auth_error=invalid_link"],
  ["/auth/callback?code=synthetic", "/login?auth_error=missing_verifier"],
]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), base + destination);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
}
for (const path of ["/login", "/register"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(/type="password"/.test(html), false);
  assert.match(html, path === "/login" ? /Selamat datang kembali/ : /Satu akun\. Banyak yang beres\./);
}
const providers = await fetch(base + "/api/auth/providers");
assert.ok([200, 503].includes(providers.status));
const status = await providers.json();
assert.deepEqual(Object.keys(status).sort(), ["available", "email", "google", "registration"]);
assert.ok(Object.values(status).every(value => typeof value === "boolean"));
console.log("Public provider status:", status);
console.log("Auth route checks passed; no real email or OAuth consent was submitted.");
