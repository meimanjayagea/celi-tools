import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FILE_LIMITS } from "@celi/file-tools";
import { FileBackendError, fileCapabilities, fileErrorResponse, processFileRequest, stopWorkers } from "./file-backend.mjs";

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

export function createFileServer({ origins = allowedWebOrigins(process.env.WEB_ORIGINS, process.env.NODE_ENV === "production"), capabilities = fileCapabilities, processFiles = processFileRequest } = {}) {
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
    try {
      const pathname = new URL(incoming.url, "http://file-api.internal").pathname;
      let response;
      if (incoming.method === "OPTIONS") {
        if (!origin) throw new FileBackendError("Origin diperlukan untuk preflight.", 403);
        outgoing.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" });
        outgoing.end();
        return;
      }
      if (incoming.method === "GET" && pathname === "/health") {
        response = Response.json({ status: "ok", service: "celi-file-api" });
      } else if (incoming.method === "GET" && ["/api/files/capabilities", "/ready"].includes(pathname)) {
        const result = await capabilities();
        const ready = Object.values(result.engines || {}).every(Boolean);
        response = Response.json(result, { status: pathname === "/ready" && !ready ? 503 : 200 });
      } else if (incoming.method === "POST" && ["/api/files/convert", "/api/files/compress"].includes(pathname)) {
        const length = Number(incoming.headers["content-length"]);
        if (!Number.isFinite(length) || length <= 0 || length > FILE_LIMITS.maxBytes + 1024 * 1024) throw new FileBackendError("Upload membutuhkan Content-Length dan maksimum 100 MB.", 413);
        const request = new Request("http://file-api.internal" + pathname, { method: "POST", headers: incoming.headers, body: Readable.toWeb(incoming), duplex: "half", signal: controller.signal });
        response = await processFiles(request, pathname.endsWith("/convert") ? "convert" : "compress");
      } else {
        response = Response.json({ error: "Endpoint tidak ditemukan." }, { status: 404 });
      }
      if (controller.signal.aborted) return;
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
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT tidak valid.");
  const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  const server = createFileServer();
  server.listen(port, host, () => console.log(`File API ready on http://${host}:${port}`));
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
