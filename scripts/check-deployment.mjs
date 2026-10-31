import assert from "node:assert/strict";
import { upload } from "@vercel/blob/client";

const args = process.argv.slice(2);
const index = args.indexOf("--web");
assert.ok(index >= 0 && args[index + 1], "Gunakan npm run check:deployment -- --web https://web.example.com");
const web = new URL(args[index + 1]);
assert.ok(web.protocol === "https:" && !web.username && !web.password && !web.search && !web.hash && web.pathname === "/", "--web harus berupa origin HTTPS production.");
const origin = web.origin;

async function request(path, options = {}) {
  return fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(300_000), ...options });
}

async function checkDeployment() {
  for (const path of ["/", "/login", "/register"]) {
    const response = await request(path, path === "/api/files/capabilities" ? { headers: { Origin: origin } } : {});
    assert.equal(response.status, 200, `${path}: status ${response.status}`);
    console.log(`PASS ${path}`);
  }

  const authResponse = await request("/api/auth/status");
  assert.equal(authResponse.status, 200, "Auth.js belum dikonfigurasi sepenuhnya.");
  assert.deepEqual(await authResponse.json(), { available: true, email: true, google: false, registration: true });
  console.log("PASS konfigurasi Auth.js email");

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

  const bytes = new TextEncoder().encode("Celi Tools synthetic deployment connection check.\n");
  const pathname = `celi-input/${crypto.randomUUID()}/deployment-check.txt`;
  let inputPath;
  let outputPath;
  try {
    const uploaded = await upload(pathname, new File([bytes], "deployment-check.txt", { type: "text/plain" }), {
      access: "private", contentType: "text/plain", handleUploadUrl: new URL("/api/files/upload", origin).href,
    });
    inputPath = uploaded.pathname;
    const processed = await request("/api/files/compress", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ files: [{ pathname: uploaded.pathname, name: "deployment-check.txt", size: bytes.byteLength }], target: "zip", preset: "balanced" }),
    });
    assert.equal(processed.status, 200, `File API: ${processed.status} ${await processed.clone().text()}`);
    const result = await processed.json();
    assert.equal(typeof result.downloadUrl, "string");
    assert.equal(result.size > 0, true);
    outputPath = result.cleanupPath;
    const download = await fetch(result.downloadUrl, { signal: AbortSignal.timeout(60_000) });
    assert.equal(download.status, 200, "Private Blob signed download gagal.");
    const archive = new Uint8Array(await download.arrayBuffer());
    assert.equal(String.fromCharCode(...archive.slice(0, 2)), "PK", "Hasil pemrosesan bukan ZIP.");
    console.log(`PASS unggah Blob privat, kompresi ZIP sintetis, dan unduhan (${archive.length} bytes)`);
  } finally {
    for (const pathnameToDelete of [inputPath, outputPath].filter(Boolean)) {
      await request("/api/files/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pathname: pathnameToDelete }),
      }).catch(() => {});
    }
  }
  console.log("Deployment check passed. Pemeriksaan ini tidak mengirim email.");
}

checkDeployment().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
