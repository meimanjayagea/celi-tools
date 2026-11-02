import { del } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "../../../../auth";
import { createFileApiToken } from "../../../lib/file-api-token.mjs";
import { fileUploadTokenOptions } from "../../../lib/file-upload-token.mjs";

const tokenRequests = new Map<string, number[]>();
const inputPathPattern = /^celi-input\/[0-9a-f-]{36}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,200}$/i;
const MAX_UPLOAD_EVENT_BYTES = 32 * 1024;

// Scanning a 100 MiB private Blob can take longer than the default function timeout.
export const maxDuration = 180;

class UploadScanError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

function configuredOrigins() {
  const configured = process.env.WEB_ORIGINS || process.env.AUTH_URL || "http://localhost:3000";
  return new Set(configured.split(",").map(value => new URL(value.trim()).origin));
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin !== null && configuredOrigins().has(origin);
}

async function readUploadEvent(request: NextRequest): Promise<Parameters<typeof handleUpload>[0]["body"]> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_EVENT_BYTES) {
    throw new UploadScanError("Metadata unggah terlalu besar.", 413);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new UploadScanError("Metadata unggah harus berupa JSON.", 415);
  }
  if (!request.body) throw new UploadScanError("Metadata unggah tidak tersedia.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_EVENT_BYTES) {
        await reader.cancel();
        throw new UploadScanError("Metadata unggah terlalu besar.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8")) as Parameters<typeof handleUpload>[0]["body"];
  } catch (error) {
    if (error instanceof UploadScanError) throw error;
    throw new UploadScanError("Metadata unggah tidak valid.", 400);
  }
}

async function scanCompletedUpload(pathname: string, tokenPayload: string | null, request: NextRequest) {
  if (!inputPathPattern.test(pathname)) {
    throw new UploadScanError("Upload tidak dapat diverifikasi dan ditolak.", 400);
  }
  try {
    if (typeof tokenPayload !== "string" || tokenPayload.length < 1 || tokenPayload.length > 200) {
      throw new UploadScanError("Upload tidak dapat diverifikasi dan ditolak.", 400);
    }
    const secret = process.env.FILE_API_SIGNING_SECRET;
    const token = createFileApiToken(tokenPayload, secret || "", { scope: "blob-scan", pathname });
    const apiOrigin = new URL(process.env.AUTH_URL || request.url).origin;
    if (!configuredOrigins().has(apiOrigin)) throw new UploadScanError("Origin layanan pemindaian tidak diizinkan.", 503);
    const response = await fetch(new URL("/api/files/scan", apiOrigin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pathname }),
      cache: "no-store",
      signal: AbortSignal.timeout(140_000),
    });
    if (response.ok) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    const status = response.status === 422 ? 422 : response.status === 413 ? 413 : 503;
    await response.body?.cancel().catch(() => {});
    const message = status === 422
      ? "File ditolak oleh pemindaian keamanan."
      : status === 413
        ? "Ukuran file melewati batas pemindaian keamanan."
        : "Pemindai keamanan tidak tersedia. File ditolak.";
    throw new UploadScanError(message, status);
  } catch (error) {
    await del(pathname).catch(() => {});
    if (error instanceof UploadScanError) throw error;
    throw new UploadScanError("Pemindai keamanan tidak tersedia. File ditolak.", 503);
  }
}

export async function POST(request: NextRequest) {
  let body: Parameters<typeof handleUpload>[0]["body"];
  try {
    body = await readUploadEvent(request);
  } catch (error) {
    const status = error instanceof UploadScanError ? error.status : 400;
    return NextResponse.json({ error: error instanceof UploadScanError ? error.message : "Permintaan unggah tidak valid." }, { status, headers: { "Cache-Control": "no-store" } });
  }

  const eventType = body && typeof body === "object" ? body.type : null;
  if (eventType !== "blob.generate-client-token" && eventType !== "blob.upload-completed") {
    return NextResponse.json({ error: "Jenis permintaan unggah tidak didukung." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let userId: string | null = null;
  if (eventType === "blob.generate-client-token") {
    if (!originAllowed(request)) {
      return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (rateLimited(clientAddress(request))) {
      return NextResponse.json({ error: "Terlalu banyak permintaan unggah. Coba lagi sebentar." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    }
    const session = await auth();
    userId = session?.user?.id || null;
    if (!userId) {
      return NextResponse.json({ error: "Silakan masuk untuk mengunggah file." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (process.env.NODE_ENV === "production" && (!process.env.FILE_API_SIGNING_SECRET || Buffer.byteLength(process.env.FILE_API_SIGNING_SECRET) < 32)) {
      return NextResponse.json({ error: "Layanan pemindaian keamanan belum dikonfigurasi." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json({ error: "Penyimpanan file belum dikonfigurasi." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => ({
        ...fileUploadTokenOptions(pathname),
        ...(process.env.NODE_ENV === "production" && userId ? { tokenPayload: userId } : {}),
      }),
      ...(process.env.NODE_ENV === "production" ? {
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          await scanCompletedUpload(blob.pathname, tokenPayload || null, request);
        },
      } : {}),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof UploadScanError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Token unggah atau pemindaian keamanan gagal. File ditolak." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
