import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { allowedWebOrigins, createFileServer } from "../apps/api/src/server.mjs";
import { FILE_LIMITS } from "@celi/file-tools";

test("production CORS requires explicit origins and rejects wildcard or credential-bearing URLs", () => {
  assert.throws(() => allowedWebOrigins(undefined, true));
  for (const value of ["*", "https://user:pass@example.com", "https://example.com/path", "http://example.com"]) assert.throws(() => allowedWebOrigins(value, true));
  assert.deepEqual([...allowedWebOrigins("https://tools.example.com,http://localhost:3000")], ["https://tools.example.com", "http://localhost:3000"]);
});

test("file API supports cross-origin uploads, exposes download headers and blocks unapproved origins", async t => {
  let uploads = 0;
  const origin = "https://tools.example.com";
  const server = createFileServer({ origins: new Set([origin]), capabilities: async () => ({ ok: true, engines: { image: true, office: false } }), processFiles: async (request, mode) => {
    uploads += 1;
    assert.equal(mode, "compress");
    const form = await request.formData();
    assert.equal(await form.get("files").text(), "synthetic-file");
    return new Response("synthetic-result", { headers: { "Content-Disposition": "attachment; filename=test.zip", "X-File-Notes": "W10=", "X-Original-Bytes": "14" } });
  } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const options = await fetch(base + "/api/files/compress", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), origin);
  assert.match(options.headers.get("access-control-allow-methods"), /POST/);
  const body = new FormData(); body.append("files", new Blob(["synthetic-file"]), "test.bin");
  const result = await fetch(base + "/api/files/compress", { method: "POST", body, headers: { Origin: origin } });
  assert.equal(result.status, 200);
  assert.equal(await result.text(), "synthetic-result");
  assert.equal(result.headers.get("access-control-allow-origin"), origin);
  assert.match(result.headers.get("access-control-expose-headers"), /Content-Disposition/);
  assert.match(result.headers.get("access-control-expose-headers"), /X-File-Notes/);
  const blocked = await fetch(base + "/api/files/compress", { method: "POST", body, headers: { Origin: "https://evil.example" } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);
  assert.equal(uploads, 1);
  assert.equal((await fetch(base + "/health")).status, 200);
  assert.equal((await fetch(base + "/ready")).status, 503);
  const oversized = await new Promise((resolve, reject) => {
    const request = http.request(base + "/api/files/compress", { method: "POST", headers: { Origin: origin, "Content-Length": String(FILE_LIMITS.maxBytes + 1024 * 1024 + 1) } }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject); request.end();
  });
  assert.equal(oversized, 413);
  assert.equal(uploads, 1);
});
