import { handleUpload } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "../../../../auth";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const tokenRequests = new Map<string, number[]>();

function clientAddress(request: NextRequest) {
  const value = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown";
  return value.split(",")[0]?.trim().slice(0, 80) || "unknown";
}

function rateLimited(address: string) {
  const now = Date.now();
  for (const [key, values] of tokenRequests) {
    const recent = values.filter(value => now - value < 60_000);
    if (recent.length) tokenRequests.set(key, recent);
    else tokenRequests.delete(key);
  }
  const recent = tokenRequests.get(address) || [];
  if (recent.length >= 20) return true;
  recent.push(now);
  tokenRequests.set(address, recent);
  return false;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const configuredOrigins = process.env.WEB_ORIGINS || process.env.AUTH_URL || "http://localhost:3000";
  const allowedOrigins = new Set(configuredOrigins.split(",").map(value => new URL(value.trim()).origin));
  if (!origin || !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Silakan masuk untuk mengunggah file." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json({ error: "Penyimpanan file belum dikonfigurasi." }, { status: 503 });
  }
  if (rateLimited(clientAddress(request))) {
    return NextResponse.json({ error: "Terlalu banyak permintaan unggah. Coba lagi sebentar." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }
  try {
    const body = await request.json();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        if (!/^celi-input\/[0-9a-f-]{36}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,200}$/i.test(pathname)) {
          throw new Error("Lokasi unggah tidak valid.");
        }
        return {
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          allowedContentTypes: ["*/*"],
          validUntil: Date.now() + TOKEN_TTL_MS,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
        };
      },
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Token unggah tidak dapat dibuat. Periksa koneksi dan coba kembali." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
