import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FILE_LIMITS } from "@celi/file-tools";
import { FileBackendError, fileCapabilities, fileErrorResponse, processBlobFileRequest, processFileRequest, scanBlobUploadRequest, deleteTemporaryFileRequest, stopWorkers } from "./file-backend.mjs";
import { waitForMalwareScanner, scanUploadedStream } from "./malware-scanner.mjs";

export function allowedWebOrigins(value, production = false) {
  if (!value && production) throw new Error("WEB_ORIGINS wajib diisi dengan origin frontend production.");
  const values = (value || "http://localhost:3000").split(",").map(item => item.trim()).filter(Boolean);
  if (!values.length) throw new Error("WEB_ORIGINS tidak boleh kosong.");
  return new Set(values.map(value => {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (value === "*" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error("WEB_ORIGINS harus berupa origin HTTPS yang eksplisit (HTTP localhost diizinkan).");
    return url.origin;
  }));
}

function normalizeAddress(value) {
  if (typeof value !== "string" || !isIP(value)) return null;
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}

function getClientAddress(incoming, trustProxy, trustedProxyHops) {
  if (trustProxy) {
    const vercelAddress = normalizeAddress(incoming.headers["x-vercel-forwarded-for"]);
    if (vercelAddress) return vercelAddress;
    const forwarded = incoming.headers["x-forwarded-for"];
    const addresses = typeof forwarded === "string" ? forwarded.split(",").map(value => value.trim()) : [];
    const candidate = addresses[addresses.length - trustedProxyHops];
    const trustedAddress = normalizeAddress(candidate);
    if (trustedAddress) return trustedAddress;
  }
  return normalizeAddress(incoming.socket.remoteAddress) || "unknown";
}

function createClientLimiter() {
  const clients = new Map();
  let requests = 0;
  return (address, kind) => {
    const now = Date.now();
    if (++requests % 128 === 0) {
      for (const [key, state] of clients) {
        if (now - state.lastSeen > 10 * 60_000 && state.activeUploads === 0) clients.delete(key);
      }
    }
    let state = clients.get(address);
    if (!state) {
      if (clients.size >= 10_000) return { allowed: false, retryAfter: 60 };
      state = { lastSeen: now, uploads: [], probes: [], activeUploads: 0 };
      clients.set(address, state);
    }
    state.lastSeen = now;
    const isUpload = kind === "upload" || kind === "guest-upload";
    const timestamps = isUpload ? state.uploads : state.probes;
    const maxRequests = kind === "guest-upload" ? 2 : kind === "upload" ? 6 : 30;
    while (timestamps.length && now - timestamps[0] >= 60_000) timestamps.shift();
    if (isUpload && state.activeUploads >= 1) return { allowed: false, retryAfter: 2 };
    if (timestamps.length >= maxRequests) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((timestamps[0] + 60_000 - now) / 1000)) };
    }
    timestamps.push(now);
    if (!isUpload) return { allowed: true, release: () => {} };
    state.activeUploads += 1;
    let released = false;
    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        state.activeUploads = Math.max(0, state.activeUploads - 1);
      },
    };
  };
}

function getValidFileClaims(header, secret) {
  if (typeof header !== "string" || !header.startsWith("Bearer ") || !secret || Buffer.byteLength(secret) < 32) return null;
  const token = header.slice(7);
  const separator = token.indexOf(".");
  if (separator < 1 || separator !== token.lastIndexOf(".")) return null;
  const payload = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1), "base64url");
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    const valid = claims.aud === "celi-file-api"
      && typeof claims.sub === "string" && claims.sub.length > 0 && claims.sub.length <= 200
      && Number.isInteger(claims.iat) && Number.isInteger(claims.exp)
      && claims.iat <= now + 30 && claims.exp > now && claims.exp > claims.iat
      && claims.exp - claims.iat <= 5 * 60;
    return valid ? claims : null;
  } catch {
    return null;
  }
}

export function createFileServer({
  origins = allowedWebOrigins(process.env.WEB_ORIGINS, process.env.NODE_ENV === "production"),
  capabilities = fileCapabilities,
  processFiles = processFileRequest,
  scannerReady = waitForMalwareScanner,
  trustProxy = process.env.FILE_TOOLS_TRUST_PROXY === "true",
  trustedProxyHops = Number(process.env.FILE_TOOLS_TRUSTED_PROXY_HOPS || 1),
} = {}) {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1 || trustedProxyHops > 8) throw new Error("FILE_TOOLS_TRUSTED_PROXY_HOPS harus berupa bilangan bulat 1-8.");
  const fileApiSecret = process.env.FILE_API_SIGNING_SECRET;
  const requireFileAuth = process.env.NODE_ENV === "production";
  if (requireFileAuth && (!fileApiSecret || Buffer.byteLength(fileApiSecret) < 32)) throw new Error("FILE_API_SIGNING_SECRET wajib berisi minimal 32 byte di production.");
  const limitClient = createClientLimiter();
  return createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 150000, headersTimeout: 30000 }, async (incoming, outgoing) => {
    const origin = incoming.headers.origin;
    outgoing.setHeader("Cache-Control", "no-store");
    outgoing.setHeader("X-Content-Type-Options", "nosniff");
    outgoing.setHeader("Vary", "Origin");
    if (origin && !origins.has(origin)) {
      outgoing.writeHead(403, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ error: "Origin frontend tidak diizinkan." }));
      incoming.resume();
      return;
    }
    if (origin) outgoing.setHeader("Access-Control-Allow-Origin", origin);
    outgoing.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, X-File-Notes, X-Original-Bytes");
    const controller = new AbortController();
    incoming.on("aborted", () => controller.abort());
    outgoing.on("close", () => { if (!outgoing.writableFinished) controller.abort(); });
    let releaseClientRequest;
    try {
      const pathname = new URL(incoming.url, "http://file-api.internal").pathname;
      let response;
      if (incoming.method === "OPTIONS") {
        if (!origin) throw new FileBackendError("Origin diperlukan untuk preflight.", 403);
        outgoing.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" });
        outgoing.end();
        return;
      }
      if (incoming.method === "GET" && pathname === "/health") {
        response = Response.json({ status: "ok", service: "celi-file-api" });
      } else if (incoming.method === "GET" && ["/api/files/capabilities", "/ready"].includes(pathname)) {
        const limit = limitClient(getClientAddress(incoming, trustProxy, trustedProxyHops), "probe");
        if (!limit.allowed) {
          response = Response.json({ error: "Terlalu banyak pemeriksaan status. Coba kembali sebentar lagi." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
        } else {
          const result = await capabilities();
          const scanner = pathname === "/ready" ? await scannerReady(controller.signal) : true;
          const ready = Object.values(result.engines || {}).every(Boolean) && scanner;
          response = Response.json(pathname === "/ready" ? { ...result, scanner: scanner ? "ready" : "unavailable" } : result, { status: pathname === "/ready" && !ready ? 503 : 200 });
        }
      } else if (incoming.method === "POST" && pathname === "/api/files/scan-api-client") {
        const claims = getValidFileClaims(incoming.headers.authorization, fileApiSecret);
        if (!claims || claims.scope !== "api-client-scan") {
          response = Response.json({ error: "Sesi pemindaian file tidak valid." }, { status: 401 });
          incoming.resume();
        } else {
          const length = Number(incoming.headers["content-length"]);
          if (!Number.isSafeInteger(length) || length < 1 || length > 512 * 1024) throw new FileBackendError("Ukuran file tidak valid.", 413);
          await scanUploadedStream(Readable.toWeb(incoming), length, controller.signal, true);
          response = Response.json({ scanned: true });
        }
      } else if (incoming.method === "POST" && pathname === "/api/files/scan") {
        const claims = getValidFileClaims(incoming.headers.authorization, fileApiSecret);
        if (!claims || claims.scope !== "blob-scan" || typeof claims.pathname !== "string") {
          response = Response.json({ error: "Sesi pemindaian file tidak valid atau kedaluwarsa." }, { status: 401 });
          incoming.resume();
        } else {
          const length = Number(incoming.headers["content-length"]);
          if (!Number.isFinite(length) || length <= 0 || length > 4096) throw new FileBackendError("Permintaan pemindaian tidak valid.", 413);
          if (!incoming.headers["content-type"]?.startsWith("application/json")) throw new FileBackendError("Metadata harus berupa JSON.", 415);
          const request = new Request("http://file-api.internal" + pathname, { method: "POST", headers: incoming.headers, body: Readable.toWeb(incoming), duplex: "half", signal: controller.signal });
          response = await scanBlobUploadRequest(request, claims.pathname);
        }
      } else if (incoming.method === "POST" && ["/api/files/convert", "/api/files/compress"].includes(pathname)) {
        const claims = getValidFileClaims(incoming.headers.authorization, fileApiSecret);
        if (requireFileAuth && (!claims || claims.scope !== undefined)) {
          response = Response.json({ error: "Sesi file tidak valid atau kedaluwarsa. Muat ulang halaman dan coba lagi." }, { status: 401 });
          incoming.resume();
        } else {
          const length = Number(incoming.headers["content-length"]);
          const isJson = incoming.headers["content-type"]?.startsWith("application/json");
          const isLocalMultipart = process.env.NODE_ENV !== "production" && incoming.headers["content-type"]?.startsWith("multipart/form-data");
          if (!Number.isFinite(length) || length <= 0 || length > (isJson ? 64 * 1024 : FILE_LIMITS.maxBytes + 1024 * 1024)) throw new FileBackendError("Metadata file tidak valid atau terlalu besar.", 413);
          if (!isJson && !isLocalMultipart) throw new FileBackendError("Metadata harus berupa JSON.", 415);
          const isGuest = claims?.kind === "guest";
          const limit = limitClient(getClientAddress(incoming, trustProxy, trustedProxyHops), isGuest ? "guest-upload" : "upload");
          if (!limit.allowed) {
            response = Response.json({ error: "Batas penggunaan file tercapai. Tunggu sebentar sebelum mencoba lagi." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
            incoming.resume();
          } else {
            releaseClientRequest = limit.release;
            const request = new Request("http://file-api.internal" + pathname, { method: "POST", headers: incoming.headers, body: Readable.toWeb(incoming), duplex: "half", signal: controller.signal });
            response = isLocalMultipart ? await processFiles(request, pathname.endsWith("/convert") ? "convert" : "compress") : await processBlobFileRequest(request, pathname.endsWith("/convert") ? "convert" : "compress", isGuest ? { maxFiles: 3, maxBytes: 25 * 1024 * 1024 } : undefined);
          }
        }
      } else if (incoming.method === "POST" && pathname === "/api/files/delete") {
        const claims = getValidFileClaims(incoming.headers.authorization, fileApiSecret);
        if (requireFileAuth && (!claims || claims.scope !== undefined)) {
          response = Response.json({ error: "Sesi file tidak valid atau kedaluwarsa." }, { status: 401 });
          incoming.resume();
        } else {
          const length = Number(incoming.headers["content-length"]);
          if (!Number.isFinite(length) || length <= 0 || length > 4096) throw new FileBackendError("Permintaan penghapusan tidak valid.", 413);
          if (!incoming.headers["content-type"]?.startsWith("application/json")) throw new FileBackendError("Metadata harus berupa JSON.", 415);
          const limit = limitClient(getClientAddress(incoming, trustProxy, trustedProxyHops), "probe");
          if (!limit.allowed) {
            response = Response.json({ error: "Terlalu banyak permintaan penghapusan." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
            incoming.resume();
          } else {
            const request = new Request("http://file-api.internal" + pathname, { method: "POST", headers: incoming.headers, body: Readable.toWeb(incoming), duplex: "half", signal: controller.signal });
            response = await deleteTemporaryFileRequest(request);
          }
        }
      } else {
        response = Response.json({ error: "Endpoint tidak ditemukan." }, { status: 404 });
      }
      if (controller.signal.aborted) {
        if (response?.body) await response.body.cancel().catch(() => {});
        return;
      }
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.writeHead(response.status);
      if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
      else outgoing.end();
    } catch (error) {
      if (outgoing.headersSent || outgoing.destroyed) return;
      const response = fileErrorResponse(error);
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.writeHead(response.status);
      outgoing.end(await response.text());
      incoming.resume();
    } finally {
      releaseClientRequest?.();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT tidak valid.");
  const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  const server = createFileServer();
  server.listen(port, host, () => {
    const targetUser = process.env.FILE_TOOLS_DROP_PRIVILEGES;
    if (targetUser && process.getuid?.() === 0) {
      try {
        process.setgroups([]);
        process.setgid(targetUser);
        process.setuid(targetUser);
      } catch (error) {
        console.error("Could not drop file API privileges:", error instanceof Error ? error.message : "unknown error");
        server.close(() => process.exit(1));
        return;
      }
    }
    console.log(`File API ready on http://${host}:${port}`);
  });
  server.on("error", error => { console.error(error.message); process.exitCode = 1; });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    stopWorkers();
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
