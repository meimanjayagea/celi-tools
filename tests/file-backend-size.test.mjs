import assert from "node:assert/strict";
import test from "node:test";
import { FileBackendError, responseOutputSize } from "../apps/api/src/file-backend.mjs";

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
