import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";

// Start the application and run the worker fixture generator before this check.
const base = process.env.FILE_TOOLS_TEST_URL || "http://localhost:3001";
const webOrigin = process.env.FILE_TOOLS_WEB_ORIGIN || "http://localhost:3000";
const output = new URL("../test-output/api/", import.meta.url);
await mkdir(output, { recursive: true });
const capabilities = await fetch(base + "/api/files/capabilities", { headers: { Origin: webOrigin } });
assert.equal(capabilities.status, 200);
assert.equal(capabilities.headers.get("access-control-allow-origin"), webOrigin);
assert.ok(Object.values((await capabilities.json()).engines).every(Boolean));
async function post(names, mode, target, headers = {}) {
  const body = new FormData();
  for (const name of names) body.append("files", new Blob([await readFile(new URL("../test-output/fixtures/" + name, import.meta.url))]), name);
  body.append("target", target);
  body.append("preset", "balanced");
  return fetch(base + "/api/files/" + mode, { method: "POST", body, headers: { Origin: webOrigin, ...headers }, signal: AbortSignal.timeout(245000) });
}
for (const [name, mode, target, signature] of [
  ["sample.png", "convert", "webp", "RIFF"],
  ["sample.docx", "convert", "pdf", "%PDF"],
  ["sample.docx", "convert", "txt", "Celi"],
  ["sample.pdf", "compress", "pdf", "%PDF"],
  ["sample.mp4", "convert", "wav", "RIFF"],
  ["sample.json", "convert", "xlsx", "PK"],
  ["sample.txt", "compress", "zip", "PK"],
]) {
  const response = await post([name], mode, target);
  assert.equal(response.status, 200, await response.clone().text());
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, signature.length).toString(), signature);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  await writeFile(new URL(`${mode}-${name}.${target}`, output), bytes);
  console.log(`${name} -> ${mode}/${target}: ${bytes.length} bytes`);
}
const sheet = await post(["sample.xlsx"], "convert", "json");
assert.equal(sheet.status, 200);
assert.equal((await sheet.json())[1].jumlah, 3);
assert.equal((await post(["sample.txt", "sample.png"], "compress", "zip")).status, 200);
assert.equal((await post(["sample.txt"], "convert", "mp4")).status, 400);
assert.equal((await post(["sample.png"], "convert", "webp", { Origin: "https://example.invalid" })).status, 403);
console.log("API integration checks passed.");
