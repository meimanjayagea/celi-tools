import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { executeApiRequest, parseCurl, parseRequestJson, replaceQuery, validateRequest } from "../apps/web/app/lib/api-client.mjs";

test("imports curl with quoted JSON and headers", () => {
  const request = parseCurl(`curl 'https://example.com/api?q=one' -X POST -H 'Authorization: Bearer abc' -H 'Content-Type: application/json' --data-raw '{"name":"Ada Lovelace"}'`);
  assert.equal(request.method, "POST");
  assert.equal(request.url, "https://example.com/api?q=one");
  assert.deepEqual(request.headers, [{ key: "Authorization", value: "Bearer abc" }, { key: "Content-Type", value: "application/json" }]);
  assert.deepEqual(JSON.parse(request.body), { name: "Ada Lovelace" });
});

test("rejects unsupported curl switches and shell operators", () => {
  assert.throws(() => parseCurl("curl -k https://example.com"), /tidak didukung/);
  assert.throws(() => parseCurl("curl https://example.com | cat"), /tidak didukung/);
});

test("imports Postman collections and ignores disabled rows", () => {
  const imported = parseRequestJson(JSON.stringify({ item: [{ name: "Get user", request: { method: "GET", url: { raw: "https://example.com/u?id=1" }, header: [{ key: "X-Test", value: "yes" }, { key: "X-Skip", value: "no", disabled: true }] } }, { name: "Create", request: { method: "POST", url: "https://example.com/u", body: { mode: "raw", raw: '{"ok":true}' } } }] }));
  assert.equal(imported.length, 2);
  assert.equal(imported[0].name, "Get user");
  assert.deepEqual(imported[0].headers, [{ key: "X-Test", value: "yes" }]);
  assert.equal(imported[1].body, '{"ok":true}');
});

test("uses enabled Postman query rows and refuses unsupported imported authentication", () => {
  const request = { method: "GET", url: { raw: "https://example.com/?q=old&hidden=1", query: [{ key: "q", value: "new" }, { key: "hidden", value: "1", disabled: true }] } };
  assert.equal(parseRequestJson(JSON.stringify(request))[0].url, "https://example.com/?q=new");
  assert.throws(() => parseRequestJson(JSON.stringify({ auth: { type: "bearer" }, item: [{ request }] })), /autentikasi/i);
});

test("updates query parameters without losing duplicates or fragment", () => {
  assert.equal(replaceQuery("https://example.com/a?old=1#part", [{ key: "q", value: "a b" }, { key: "q", value: "two" }]), "https://example.com/a?q=a+b&q=two#part");
});

test("validates schemes, header names, JSON bodies and GET body", () => {
  const base = { method: "POST", url: "https://example.com", headers: [], body: "{}" };
  assert.throws(() => validateRequest({ ...base, url: "file:///etc/passwd" }), /http/i);
  assert.throws(() => validateRequest({ ...base, headers: [{ key: "Bad Header", value: "x" }] }), /header/i);
  assert.throws(() => validateRequest({ ...base, body: "{" }), /JSON/i);
  assert.throws(() => validateRequest({ ...base, method: "GET" }), /GET/i);
  assert.equal(validateRequest(base).url, "https://example.com/");
});

test("sends a JSON request and shows status, timing, size, and formatted response", async () => {
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ method: request.method, url: request.url, header: request.headers["x-test"], body: JSON.parse(body) }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const request = validateRequest({ method: "POST", url: `http://127.0.0.1:${port}/items?q=1`, headers: [{ key: "X-Test", value: "ok" }], body: '{"value":1}' });
    const result = await executeApiRequest(request);
    assert.equal(result.status, 201);
    assert.ok(result.milliseconds >= 0);
    assert.ok(result.bytes > 0);
    assert.match(result.text, /\n/);
    assert.deepEqual(JSON.parse(result.text), { method: "POST", url: "/items?q=1", header: "ok", body: { value: 1 } });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("limits response data displayed for very large payloads", async () => {
  const server = createServer((_request, response) => response.end("a".repeat(2 * 1024 * 1024 + 10)));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const request = validateRequest({ method: "GET", url: `http://127.0.0.1:${server.address().port}/`, headers: [], body: "" });
    const result = await executeApiRequest(request);
    assert.equal(result.bytes, 2 * 1024 * 1024);
    assert.equal(result.truncated, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("sends each supported HTTP method to the server", async () => {
  const server = createServer((request, response) => response.end(request.method));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const request = validateRequest({ method, url: `http://127.0.0.1:${server.address().port}/`, headers: [], body: "" });
      assert.equal((await executeApiRequest(request)).text, method);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("authorization supports bearer, basic and API key without overwriting manual credentials", async () => {
  const { applyAuthorization } = await import('../apps/web/app/lib/api-client.mjs');
  const base = { method: 'GET', url: 'https://example.com/', headers: [], body: '' };
  assert.equal(applyAuthorization(base, { type: 'bearer', token: 'secret' }).headers[0].value, 'Bearer secret');
  assert.equal(applyAuthorization(base, { type: 'basic', username: 'ada', password: 'pw' }).headers[0].value, 'Basic YWRhOnB3');
  assert.equal(new URL(applyAuthorization(base, { type: 'api-key', key: 'api_key', value: 'abc', placement: 'query' }).url).searchParams.get('api_key'), 'abc');
  assert.throws(() => applyAuthorization({ ...base, headers: [{ key: 'authorization', value: 'x' }] }, { type: 'bearer', token: 'secret' }), /Authorization/i);
});

test('saved requests remove authorization, sensitive headers and URL credentials', async () => {
  const { sanitizeSavedRequest } = await import('../apps/web/app/lib/api-client.mjs');
  const saved = sanitizeSavedRequest({ method: 'GET', url: 'https://example.com/?api_key=abc&q=ok', headers: [{key:'Authorization',value:'Bearer secret'}, {key:'X-API-Key',value:'secret'}, {key:'Accept',value:'application/json'}], body:'', name:'Example' });
  assert.deepEqual(saved.headers, [{key:'Accept',value:'application/json'}]);
  assert.equal(new URL(saved.url).searchParams.get('api_key'), null);
  assert.equal(new URL(saved.url).searchParams.get('q'), 'ok');
});

test('limited scripts set variables and run status and body checks without executing JavaScript', async () => {
  const { runApiScript, resolveApiVariables } = await import('../apps/web/app/lib/api-client.mjs');
  const pre = runApiScript('pm.environment.set("id", "42");', {}, null);
  assert.equal(resolveApiVariables('https://example.com/{{id}}', pre.variables), 'https://example.com/42');
  const result = runApiScript('pm.test("status", () => pm.response.to.have.status(200));\npm.test("body", () => pm.expect(pm.response.json().ok).to.eql(true));', {}, { status: 200, text: '{"ok":true}' });
  assert.deepEqual(result.tests.map(item => item.passed), [true, true]);
  assert.throws(() => runApiScript('fetch("https://evil.example")', {}, null), /tidak didukung/i);
});

test('saving preserves request variables in URL paths and query strings', async () => {
  const { sanitizeSavedRequest } = await import('../apps/web/app/lib/api-client.mjs');
  const request = sanitizeSavedRequest({ name:'Variable', method:'GET', url:'https://example.com/users/{{id}}?q={{query}}', headers:[], body:'' });
  assert.match(request.url, /\{\{id\}\}/);
  assert.match(request.url, /\{\{query\}\}/);
});
