import { createHash } from "node:crypto";
import { auth } from "../../../../auth";
import { pool } from "../../../lib/database";
import { executeProxyRequest, validateProxyRequest } from "../../../lib/api-proxy.mjs";
import { createFileApiToken } from "../../../lib/file-api-token.mjs";

const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
function json(data: unknown, status = 200) { return Response.json(data, { status, headers }); }

async function readLimited(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request kosong.");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_200_000) { await reader.cancel(); throw new Error("Request terlalu besar."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Permintaan tidak diizinkan." }, 403);
  let userId: string | undefined;
  try { userId = (await auth())?.user?.id; } catch { return json({ error: "Autentikasi belum tersedia." }, 503); }
  if (!userId) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
  if (!pool) return json({ error: "Layanan API Client belum tersedia." }, 503);
  let input: unknown;
  try { input = await readLimited(request); }
  catch { return json({ error: "Request tidak valid atau terlalu besar." }, 400); }
  try { validateProxyRequest(input); }
  catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Request tidak valid." }, 400); }
  try {
    const buckets = [{ key: `api-client:${userId}`, limit: 20 }, { key: "api-client:global", limit: 120 }];
    for (const bucket of buckets) {
    const key = createHash("sha256").update(bucket.key).digest("hex");
    const result = await pool.query(`INSERT INTO celi_auth.auth_ip_rate_limits (ip_hash, window_started_at, request_count)
      VALUES ($1, now(), 1) ON CONFLICT (ip_hash) DO UPDATE SET
      window_started_at = CASE WHEN celi_auth.auth_ip_rate_limits.window_started_at < now() - interval '1 minute' THEN now() ELSE celi_auth.auth_ip_rate_limits.window_started_at END,
      request_count = CASE WHEN celi_auth.auth_ip_rate_limits.window_started_at < now() - interval '1 minute' THEN 1 ELSE celi_auth.auth_ip_rate_limits.request_count + 1 END
      WHERE celi_auth.auth_ip_rate_limits.window_started_at < now() - interval '1 minute' OR celi_auth.auth_ip_rate_limits.request_count < $2 RETURNING request_count`, [key, bucket.limit]);
    if (!result.rowCount) return json({ error: "Batas request tercapai. Coba lagi sebentar." }, 429);
    }
  } catch { return json({ error: "Layanan API Client belum tersedia." }, 503); }
  const file = (input as { file?: { base64: string } }).file;
  if (file) {
    try {
      const bytes = Buffer.from(file.base64, "base64");
      const secret = process.env.FILE_API_SIGNING_SECRET || "";
      const token = createFileApiToken(userId, secret, { scope: "api-client-scan" });
      const service = process.env.NODE_ENV === "production" ? process.env.AUTH_URL || request.url : process.env.NEXT_PUBLIC_FILE_API_URL || "http://localhost:3001";
      const scanUrl = new URL("/api/files/scan-api-client", new URL(service).origin);
      const scanned = await fetch(scanUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: new Uint8Array(bytes), cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!scanned.ok || (await scanned.json()).scanned !== true) return json({ error: "File ditolak atau pemindai keamanan tidak tersedia." }, scanned.status === 422 ? 422 : 503);
    } catch { return json({ error: "Pemindai keamanan tidak tersedia. File ditolak." }, 503); }
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    try { return json(await executeProxyRequest(input, controller.signal)); }
    finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
  } catch (cause) { return json({ error: cause instanceof Error ? cause.message : "API tidak dapat dijangkau." }, 502); }
}
