import { auth } from "../../../../auth";
import { createFileApiToken } from "../../../lib/file-api-token.mjs";

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

  const token = createFileApiToken(userId, secret);
  return Response.json({ token, expiresIn: 5 * 60 }, { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}
