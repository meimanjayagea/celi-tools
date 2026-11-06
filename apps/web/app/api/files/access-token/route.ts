import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "../../../../auth";
import { createFileApiToken } from "../../../lib/file-api-token.mjs";
import { FILE_UPLOAD_LIMITS } from "../../../lib/file-upload-token.mjs";

const GUEST_COOKIE = "celimanapp-file-guest";
const guestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let session = null;
  try { session = await auth(); } catch { /* Local file tools remain available in guest mode if Auth.js is unavailable. */ }
  let userId = session?.user?.id;
  let guest = false;
  if (!userId) {
    const cookieStore = await cookies();
    let guestId = cookieStore.get(GUEST_COOKIE)?.value;
    if (!guestIdPattern.test(guestId || "")) {
      guestId = randomUUID();
      cookieStore.set(GUEST_COOKIE, guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }
    userId = `guest:${guestId}`;
    guest = true;
  }

  const token = createFileApiToken(userId, secret, guest ? { kind: "guest" } : {});
  return Response.json({
    token,
    expiresIn: 5 * 60,
    guest,
    maxFiles: guest ? FILE_UPLOAD_LIMITS.maxGuestFiles : 10,
    maxFileBytes: guest ? FILE_UPLOAD_LIMITS.maxGuestBytes : FILE_UPLOAD_LIMITS.maxBytes,
    maxTotalBytes: guest ? FILE_UPLOAD_LIMITS.maxGuestTotalBytes : FILE_UPLOAD_LIMITS.maxBytes,
  }, { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}
