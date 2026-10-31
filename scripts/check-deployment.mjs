import assert from "node:assert/strict";

// This check uploads only synthetic text. It never reads local credentials/files.
const argumentsList = process.argv.slice(2);
function originArgument(name) {
  const index = argumentsList.indexOf(name);
  assert.ok(index >= 0 && argumentsList[index + 1], `Gunakan npm run check:deployment -- --web https://web.example.com --api https://api.example.com`);
  const url = new URL(argumentsList[index + 1]);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  assert.ok(url.protocol === "https:" || (local && url.protocol === "http:"), `${name} harus menggunakan HTTPS (HTTP hanya localhost).`);
  assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/", `${name} harus berupa origin tanpa path atau kredensial.`);
  return url.origin;
}

async function checkDeployment() {
  const web = originArgument("--web");
  const api = originArgument("--api");
  async function request(url, options = {}) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60000), ...options });
    assert.ok(![301, 302, 303, 307, 308, 401].includes(response.status), `${url}: status ${response.status}; periksa domain atau deployment protection.`);
    return response;
  }
  const webPage = await request(web);
  assert.equal(webPage.status, 200, "Halaman web belum siap.");
  console.log("PASS halaman web");

  const authResponse = await request(`${web}/api/auth/status`);
  assert.equal(authResponse.status, 200, "Auth.js belum dikonfigurasi. Isi environment Vercel dan siapkan PostgreSQL/SMTP.");
  const auth = await authResponse.json();
  assert.deepEqual(auth, { available: true, email: true, google: false, registration: true });
  console.log("PASS konfigurasi autentikasi tautan email");

  for (const route of ["/health", "/ready", "/api/files/capabilities"]) {
    const response = await request(`${api}${route}`, { headers: { Origin: web } });
    assert.equal(response.status, 200, `${route}: API atau engine belum siap.`);
    assert.equal(response.headers.get("access-control-allow-origin"), web, `${route}: WEB_ORIGINS belum sesuai domain web.`);
    if (route !== "/health") {
      const result = await response.json();
      assert.ok(Object.keys(result.engines || {}).length > 0 && Object.values(result.engines).every(Boolean), "Ada engine file yang belum tersedia.");
    }
    console.log(`PASS ${route} dan CORS`);
  }
  const preflight = await request(`${api}/api/files/compress`, { method: "OPTIONS", headers: { Origin: web, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  assert.equal(preflight.status, 204, "Preflight upload ditolak.");
  assert.equal(preflight.headers.get("access-control-allow-origin"), web);
  assert.match(preflight.headers.get("access-control-allow-methods") || "", /POST/);
  console.log("PASS preflight upload");

  const form = new FormData();
  form.append("files", new Blob(["Celi Tools synthetic deployment connection check.\n"]), "connection-check.txt");
  form.append("target", "zip");
  form.append("preset", "balanced");
  const archive = await request(`${api}/api/files/compress`, { method: "POST", headers: { Origin: web }, body: form });
  assert.equal(archive.status, 200, "Pemrosesan file belum berhasil.");
  assert.equal(archive.headers.get("access-control-allow-origin"), web);
  assert.match(archive.headers.get("content-disposition") || "", /attachment/);
  assert.match(archive.headers.get("access-control-expose-headers") || "", /Content-Disposition/i);
  const bytes = new Uint8Array(await archive.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK", "Hasil kompresi bukan ZIP.");
  console.log(`PASS kompresi ZIP sintetis (${bytes.length} bytes) dan header unduhan`);

  const denied = await request(`${api}/api/files/capabilities`, { headers: { Origin: "https://unapproved-deployment-check.invalid" } });
  assert.equal(denied.status, 403, "Origin asing seharusnya ditolak.");
  console.log("PASS origin asing ditolak");
  console.log("Koneksi HTTP web dan API lolos. Pastikan FILE_API_URL di Vercel sama dengan --api, redeploy, lalu uji upload dari browser.");
}

checkDeployment().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
