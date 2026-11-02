import { createHmac } from "node:crypto";

const TOKEN_TTL_SECONDS = 5 * 60;

/** Create a short-lived HMAC bearer token for the private file API. */
export function createFileApiToken(userId, secret, extraClaims = {}, now = Date.now()) {
  if (typeof userId !== "string" || !userId || userId.length > 200) {
    throw new Error("Identitas pengguna untuk layanan file tidak valid.");
  }
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new Error("FILE_API_SIGNING_SECRET harus berisi minimal 32 byte.");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    ...extraClaims,
    aud: "celi-file-api",
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
