export const FILE_UPLOAD_LIMITS = {
  maxBytes: 100 * 1024 * 1024,
  maxGuestBytes: 25 * 1024 * 1024,
  maxGuestTotalBytes: 25 * 1024 * 1024,
  maxGuestFiles: 3,
  tokenTtlMs: 10 * 60 * 1000,
};

const inputPathPattern = /^celi-input\/[0-9a-f-]{36}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,200}$/i;

/**
 * Build the short-lived client-upload policy for a private conversion input.
 * Content types are intentionally unrestricted: compression accepts arbitrary
 * file extensions, while conversion validates extensions and file contents in
 * the processing worker. Blob MIME wildcards only match individual categories.
 */
export function fileUploadTokenOptions(pathname, now = Date.now(), maximumSizeInBytes = FILE_UPLOAD_LIMITS.maxBytes) {
  if (typeof pathname !== "string" || !inputPathPattern.test(pathname)) {
    throw new Error("Lokasi unggah tidak valid.");
  }
  if (!Number.isSafeInteger(maximumSizeInBytes) || maximumSizeInBytes < 1 || maximumSizeInBytes > FILE_UPLOAD_LIMITS.maxBytes) {
    throw new Error("Batas ukuran unggah tidak valid.");
  }

  return {
    maximumSizeInBytes,
    validUntil: now + FILE_UPLOAD_LIMITS.tokenTtlMs,
    addRandomSuffix: true,
    allowOverwrite: false,
    cacheControlMaxAge: 60,
  };
}
