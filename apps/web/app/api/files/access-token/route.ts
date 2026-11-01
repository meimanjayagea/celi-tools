import { createHmac } from "node:crypto";
import { auth } from "../../../../auth";

const TOKEN_TTL_SECONDS = 5 * 60;

function allowedOrigins() {
  const configured = process.env.WEB_ORIGINS || process.env.AUTH_URL || "http://localhost:3000";
  return new Set(configured.split(",").map(value => new URL(value.trim()).origin));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) {
    return Response.json({ error: "Origin tidak diizinkan." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const secret = process.env.FILE_API_SIGNING_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    return Response.json({ error: "Layanan file belum dikonfigurasi." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Silakan masuk untuk menggunakan layanan file." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ aud: "celi-file-api", sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return Response.json({ token: `${payload}.${signature}`, expiresIn: TOKEN_TTL_SECONDS }, { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}
