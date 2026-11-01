import assert from "node:assert/strict";
import test from "node:test";
import { FileBackendError, readBlobContents, responseOutputSize } from "../apps/api/src/file-backend.mjs";

test("reports output byte length from the streaming response headers", () => {
  assert.equal(responseOutputSize(new Response("synthetic PDF", { headers: { "Content-Length": "13" } })), 13);
});

test("rejects missing, invalid, empty and oversized output lengths", () => {
  for (const response of [
    new Response("missing"),
    new Response("invalid", { headers: { "Content-Length": "NaN" } }),
    new Response("decimal", { headers: { "Content-Length": "1.5" } }),
    new Response("empty", { headers: { "Content-Length": "0" } }),
    new Response("oversized", { headers: { "Content-Length": String(200 * 1024 * 1024 + 1) } }),
  ]) {
    assert.throws(() => responseOutputSize(response), error => error instanceof FileBackendError && error.status === 500);
  }
});

test("validates actual Blob stream bytes rather than trusting Blob size metadata", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const contents = await readBlobContents(new Blob([bytes]).stream(), bytes.length);
  assert.equal(contents.size, bytes.length);
  assert.deepEqual([...new Uint8Array(await contents.arrayBuffer())], [...bytes]);
});

test("rejects missing, oversized and out-of-limit Blob stream content", async () => {
  await assert.rejects(readBlobContents(new Blob(["abc"]).stream(), 4), error => error instanceof FileBackendError && error.status === 400);
  await assert.rejects(readBlobContents(new Blob(["abcd"]).stream(), 3), error => error instanceof FileBackendError && error.status === 400);
  await assert.rejects(readBlobContents(new Blob(["x"]).stream(), 100 * 1024 * 1024 + 1), error => error instanceof FileBackendError && error.status === 400);
});
