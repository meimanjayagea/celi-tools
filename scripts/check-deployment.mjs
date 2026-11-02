import assert from "node:assert/strict";

const args = process.argv.slice(2);
const index = args.indexOf("--web");
assert.ok(index >= 0 && args[index + 1], "Gunakan npm run check:deployment -- --web https://web.example.com");
const web = new URL(args[index + 1]);
assert.ok(web.protocol === "https:" && !web.username && !web.password && !web.search && !web.hash && web.pathname === "/", "--web harus berupa origin HTTPS production.");
const origin = web.origin;

function request(path, options = {}) {
  return fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(300_000), ...options });
}

async function checkDeployment() {
  for (const path of ["/", "/login"]) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path}: status ${response.status}`);
    console.log(`PASS ${path}`);
  }

  const registration = await request("/register");
  const registrationTarget = registration.headers.get("location") || await registration.text();
  assert.ok([200, 303, 307, 308].includes(registration.status) && /(?:\/login|%2Flogin)/i.test(registrationTarget), "/register tidak meneruskan ke login.");
  console.log("PASS registrasi mengarah ke login");

  const authResponse = await request("/api/auth/status");
  assert.equal(authResponse.status, 200, "Auth.js belum dikonfigurasi sepenuhnya.");
  const auth = await authResponse.json();
  assert.equal(auth.available, true, "Autentikasi tidak tersedia.");
  assert.equal(auth.google, true, "Google OAuth tidak tersedia.");
  assert.equal(auth.email, false, "Provider email tidak seharusnya aktif.");
  console.log("PASS konfigurasi Google OAuth");

  for (const path of ["/health", "/ready", "/api/files/capabilities"]) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path}: API/container atau engine belum siap.`);
    if (path !== "/health") {
      const result = await response.json();
      assert.ok(Object.keys(result.engines || {}).length > 0 && Object.values(result.engines).every(Boolean), `${path}: ada engine yang belum siap.`);
    }
    console.log(`PASS ${path}`);
  }

  const denied = await request("/api/files/capabilities", { headers: { Origin: "https://unapproved-deployment-check.invalid" } });
  assert.equal(denied.status, 403, "Origin asing seharusnya ditolak.");
  console.log("PASS origin asing ditolak");

  for (const path of ["/api/files/access-token", "/api/files/scan"]) {
    const response = await request(path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 401, `${path}: request tanpa autentikasi seharusnya ditolak.`);
    console.log(`PASS ${path} memerlukan autentikasi`);
  }
  console.log("Pemeriksaan publik selesai. Login Google dan upload privat memerlukan pengujian browser dengan akun uji.");
}

checkDeployment().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
