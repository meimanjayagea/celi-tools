export const aiHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export const aiJson = (body: unknown, status = 200) => Response.json(body, { status, headers: aiHeaders });

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function readAiJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid request");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("Request too large"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

export function recordAiRequest(pool: import("pg").Pool, key: string, limit = 10) {
  return pool.query(`INSERT INTO celi_auth.auth_ip_rate_limits (ip_hash, window_started_at, request_count)
    VALUES ($1, now(), 1) ON CONFLICT (ip_hash) DO UPDATE SET
    window_started_at = CASE WHEN celi_auth.auth_ip_rate_limits.window_started_at < now() - interval '1 minute' THEN now() ELSE celi_auth.auth_ip_rate_limits.window_started_at END,
    request_count = CASE WHEN celi_auth.auth_ip_rate_limits.window_started_at < now() - interval '1 minute' THEN 1 ELSE celi_auth.auth_ip_rate_limits.request_count + 1 END
    WHERE celi_auth.auth_ip_rate_limits.window_started_at < now() - interval '1 minute' OR celi_auth.auth_ip_rate_limits.request_count < $2 RETURNING request_count`, [key, limit]);
}
