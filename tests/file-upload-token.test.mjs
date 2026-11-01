import assert from "node:assert/strict";
import test from "node:test";
import { fileUploadTokenOptions, FILE_UPLOAD_LIMITS } from "../apps/web/app/lib/file-upload-token.mjs";

test("Blob client tokens accept real MIME types needed by supported formats", () => {
  const policy = fileUploadTokenOptions("celi-input/123e4567-e89b-12d3-a456-426614174000/input.pdf", 1000);
  assert.equal(policy.maximumSizeInBytes, 100 * 1024 * 1024);
  assert.equal(policy.validUntil, 1000 + FILE_UPLOAD_LIMITS.tokenTtlMs);
  assert.equal(policy.addRandomSuffix, true);
  assert.equal(policy.allowOverwrite, false);
  assert.equal(policy.cacheControlMaxAge, 60);
  assert.equal("allowedContentTypes" in policy, false);
});

test("Blob upload tokens reject unsafe and out-of-scope paths", () => {
  for (const pathname of [
    "celi-output/123e4567-e89b-12d3-a456-426614174000/file.pdf",
    "celi-input/123e4567-e89b-12d3-a456-426614174000/../secret.pdf",
    "celi-input/123e4567-e89b-12d3-a456-426614174000/.",
    "celi-input/not-a-uuid/file.pdf",
    "https://example.invalid/file.pdf",
  ]) assert.throws(() => fileUploadTokenOptions(pathname), /Lokasi unggah tidak valid/);
});
