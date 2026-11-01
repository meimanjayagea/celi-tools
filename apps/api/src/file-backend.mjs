import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm, stat, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { del, get, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
import { FILE_LIMITS, converterGroup, validateSelection } from "@celi/file-tools";
export class FileBackendError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
export function responseOutputSize(response) {
    const contentLength = response.headers.get("content-length");
    const size = contentLength === null ? NaN : Number(contentLength);
    if (!Number.isSafeInteger(size) || size < 1 || size > FILE_LIMITS.maxOutputBytes)
        throw new FileBackendError("Ukuran hasil tidak valid.", 500);
    return size;
}
const shared = globalThis;
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const runtimeRoot = path.resolve(process.env.FILE_TOOLS_RUNTIME_ROOT || path.join(repoRoot, '.file-tools'));
const activeWorkers = new Set();
function killWorker(child) {
    if (child.exitCode !== null) return;
    if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, shell: false });
        killer.on("error", () => child.kill());
    } else {
        child.kill("SIGTERM");
        setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3000).unref();
    }
}
export function stopWorkers() { activeWorkers.forEach(killWorker); }
function pythonPath() {
    if (process.env.FILE_TOOLS_PYTHON)
        return process.env.FILE_TOOLS_PYTHON;
    const local = path.join(runtimeRoot, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    return existsSync(local) ? local : process.platform === "win32" ? "python" : "python3";
}
function runWorker(args, timeout = 240_000, signal) {
    return new Promise((resolve, reject) => {
        const child = spawn(pythonPath(), [path.join(apiRoot, "server/file_worker.py"), ...args], {
            shell: false, windowsHide: true, env: { ...process.env, FILE_TOOLS_RUNTIME_ROOT: runtimeRoot, PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" },
            stdio: ["ignore", "pipe", "pipe"],
        });
        activeWorkers.add(child);
        let aborted = false;
        const cancel = () => { aborted = true; killWorker(child); };
        signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) cancel();
        let stdout = "", stderr = "", timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            // Kill only this job and its descendants; media/Office are worker children.
            if (process.platform === "win32" && child.pid) {
                const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, shell: false });
                killer.on("error", () => child.kill());
            }
            else {
                child.kill("SIGTERM");
                setTimeout(() => { if (child.exitCode === null)
                    child.kill("SIGKILL"); }, 3000).unref();
            }
        }, timeout);
        child.stdout.on("data", chunk => { if (stdout.length < 1_000_000)
            stdout += chunk.toString(); });
        child.stderr.on("data", chunk => { if (stderr.length < 4000)
            stderr += chunk.toString(); });
        child.on("error", () => { clearTimeout(timer); reject(new FileBackendError("Engine file belum siap. Jalankan setup backend sesuai README.", 503)); });
        child.on("close", () => {
            activeWorkers.delete(child);
            signal?.removeEventListener("abort", cancel);
            clearTimeout(timer);
            if (aborted) { reject(new FileBackendError("Pemrosesan dibatalkan.", 499)); return; }
            if (timedOut) {
                reject(new FileBackendError("Proses melewati batas 4 menit. Kurangi jumlah/ukuran file dan coba lagi.", 408));
                return;
            }
            try {
                const line = stdout.trim().split(/\r?\n/).at(-1) || "";
                const result = JSON.parse(line);
                if (!result.ok)
                    reject(new FileBackendError(result.error || "File tidak dapat diproses."));
                else
                    resolve(result);
            }
            catch (error) {
                if (error instanceof FileBackendError)
                    reject(error);
                else {
                    console.error("File worker could not return a valid result:", stderr.slice(0, 400));
                    reject(new FileBackendError("Engine pemrosesan belum siap atau berhenti. Coba lagi.", 503));
                }
            }
        });
    });
}
export async function fileCapabilities() {
    if (shared.fileToolsCapabilities && shared.fileToolsCapabilities.until > Date.now())
        return shared.fileToolsCapabilities.result;
    if (!shared.fileToolsCapabilitiesPromise) {
        shared.fileToolsCapabilitiesPromise = runWorker(["--capabilities"], 20_000)
            .then(result => {
                shared.fileToolsCapabilities = { result, until: Date.now() + 60_000 };
                return result;
            })
            .finally(() => { shared.fileToolsCapabilitiesPromise = undefined; });
    }
    return shared.fileToolsCapabilitiesPromise;
}
function safeName(name, index) {
    const base = name.replaceAll("\\", "/").split("/").at(-1) || "file";
    const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/, "").slice(-140) || "file";
    return `${index + 1}-${cleaned}`;
}
export async function processFileRequest(request, mode) {
    // Origin validation and CORS are enforced by the HTTP server.
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0 || length > FILE_LIMITS.maxBytes + 1024 * 1024)
        throw new FileBackendError("Upload membutuhkan Content-Length dan maksimum 100 MB.", 413);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
        throw new FileBackendError("Upload harus berupa multipart/form-data.", 415);
    if ((shared.fileToolsActive || 0) >= 2)
        throw new FileBackendError("Server sedang memproses file lain. Coba kembali sebentar lagi.", 429);
    shared.fileToolsActive = (shared.fileToolsActive || 0) + 1;
    let directory;
    let form;
    let files = [];
    let streamingResponse = false;
    let cleanupPromise;
    const cleanup = () => cleanupPromise ||= (async () => {
        if (directory) {
            // The worker uses short OS-temp profiles for Windows path compatibility.
            // Keep their manifest in the job so timeout/crash cleanup also removes them.
            try {
                const profiles = JSON.parse(await readFile(path.join(directory, "office-profiles.json"), "utf8"));
                if (Array.isArray(profiles))
                    for (const profile of profiles.slice(0, 30)) {
                        if (typeof profile === "string" && path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && /^cf-[a-z0-9_]{8}$/.test(path.basename(profile))) {
                            await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
                        }
                    }
            }
            catch (error) {
                if (error.code !== "ENOENT")
                    console.error("Could not clean an Office job profile.");
            }
            await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch(() => console.error("Could not remove a file processing job directory."));
            directory = undefined;
        }
        shared.fileToolsActive = Math.max(0, (shared.fileToolsActive || 1) - 1);
    })();
    try {
        form = await request.formData();
        files = form.getAll("files").filter((entry) => entry instanceof File);
        const target = String(form.get("target") || "");
        const preset = String(form.get("preset") || "balanced");
        if (!["small", "balanced", "quality"].includes(preset))
            throw new FileBackendError("Preset tidak valid.");
        const capabilities = await fileCapabilities();
        const message = validateSelection(files, mode, target, capabilities.engines);
        if (message)
            throw new FileBackendError(message);
        if (request.signal.aborted)
            throw new FileBackendError("Upload dibatalkan.", 499);
        const root = path.join(runtimeRoot, "jobs");
        await mkdir(root, { recursive: true });
        directory = await mkdtemp(path.join(root, "job-"));
        const uploaded = [];
        for (const [index, file] of files.entries()) {
            const name = safeName(file.name, index);
            const destination = path.join(directory, name);
            await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
            uploaded.push({ path: destination, safeName: name, group: converterGroup(file.name)?.id || "archive" });
        }
        const originalBytes = files.reduce((sum, file) => sum + file.size, 0);
        files = [];
        form = undefined;
        const jobPath = path.join(directory, "job.json");
        await writeFile(jobPath, JSON.stringify({ mode, target, preset, directory, files: uploaded }));
        const result = await runWorker([jobPath], 240_000, request.signal);
        if (!result.path || !result.name || !path.resolve(result.path).startsWith(directory + path.sep))
            throw new FileBackendError("Hasil engine tidak valid.", 500);
        const info = await stat(result.path);
        if (info.size > FILE_LIMITS.maxOutputBytes)
            throw new FileBackendError("Hasil melebihi batas 200 MB.", 413);
        const content = createReadStream(result.path);
        content.once("close", () => { void cleanup(); });
        content.once("error", () => { void cleanup(); });
        const response = new Response(Readable.toWeb(content), {
            headers: {
                "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`,
                "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
                "X-File-Notes": Buffer.from(JSON.stringify(result.notes || [])).toString("base64"),
                "X-Original-Bytes": String(originalBytes),
                "Content-Length": String(info.size),
            },
        });
        streamingResponse = true;
        return response;
    }
    finally {
        if (!streamingResponse) await cleanup();
    }
}

async function removeExpiredFileResults() {
    try {
        const expiry = Date.now() - 24 * 60 * 60 * 1000;
        for (const prefix of ["celi-input/", "celi-output/"]) {
            const { blobs } = await list({ prefix, limit: 1000 });
            const expired = blobs.filter(blob => blob.uploadedAt.getTime() < expiry).map(blob => blob.pathname);
            if (expired.length) await del(expired);
        }
    }
    catch (error) {
        console.error("Temporary file cleanup could not complete.", error instanceof Error ? error.name : "unknown");
    }
}

export async function processBlobFileRequest(request, mode) {
    const inputPaths = [];
    let outputPath;
    try {
        const payload = await request.json();
        if (!payload || !Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > FILE_LIMITS.maxFiles)
            throw new FileBackendError("Pilih 1 sampai 10 file untuk diproses.");
        if (typeof payload.target !== "string" || typeof payload.preset !== "string")
            throw new FileBackendError("Pilihan pemrosesan tidak valid.");
        const files = [];
        const seen = new Set();
        let sizeTotal = 0;
        for (const entry of payload.files) {
            if (!entry || typeof entry.pathname !== "string" || !/^celi-input\/[0-9a-f-]{36}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,200}$/i.test(entry.pathname) || typeof entry.name !== "string" || entry.name.length > 255 || !Number.isSafeInteger(entry.size) || entry.size <= 0 || seen.has(entry.pathname)) {
                throw new FileBackendError("Daftar file unggahan tidak valid.");
            }
            seen.add(entry.pathname);
            inputPaths.push(entry.pathname);
            sizeTotal += entry.size;
            if (sizeTotal > FILE_LIMITS.maxBytes) throw new FileBackendError("Total file melebihi batas 100 MB.", 413);
            const stored = await get(entry.pathname, { access: "private", abortSignal: request.signal, useCache: false });
            if (!stored || stored.blob.size !== entry.size) throw new FileBackendError("File unggahan tidak ditemukan atau ukurannya berubah.", 400);
            const contents = await new Response(stored.stream).blob();
            files.push(new File([contents], entry.name, { type: stored.blob.contentType || "application/octet-stream" }));
        }
        if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) throw new FileBackendError("Penyimpanan file belum dikonfigurasi.", 503);
        await removeExpiredFileResults();
        const form = new FormData();
        files.forEach(file => form.append("files", file));
        form.set("target", payload.target);
        form.set("preset", payload.preset);
        const syntheticLength = sizeTotal + 64 * 1024;
        const internalRequest = new Request(`http://file-api.internal/api/files/${mode}`, {
            method: "POST", headers: { "content-length": String(Math.min(syntheticLength, FILE_LIMITS.maxBytes + 1024 * 1024)) },
            body: form, signal: request.signal,
        });
        // Request/FormData supplies its own multipart boundary; content-length is only used for the backend's size guard.
        const result = await processFileRequest(internalRequest, mode);
        if (!result.ok) throw new FileBackendError(await result.text(), result.status);
        const outputSize = responseOutputSize(result);
        const disposition = result.headers.get("content-disposition") || "";
        const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const name = encodedName ? decodeURIComponent(encodedName) : "celi-result.zip";
        const outputId = crypto.randomUUID();
        const safeOutputName = name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180) || "result.bin";
        outputPath = `celi-output/${outputId}/${safeOutputName}`;
        const uploaded = await put(outputPath, result.body, {
            access: "private", multipart: true, maximumSizeInBytes: FILE_LIMITS.maxOutputBytes,
            contentType: "application/octet-stream", cacheControlMaxAge: 60,
        });
        const expiresAt = Date.now() + 60 * 60 * 1000;
        const signedToken = await issueSignedToken({ pathname: uploaded.pathname, operations: ["get"], validUntil: expiresAt });
        const { presignedUrl } = await presignUrl(signedToken, { operation: "get", pathname: uploaded.pathname, access: "private", validUntil: expiresAt });
        const notes = JSON.parse(Buffer.from(result.headers.get("x-file-notes") || "", "base64").toString("utf8") || "[]");
        return Response.json({ downloadUrl: presignedUrl, cleanupPath: uploaded.pathname, name, size: outputSize, notes, expiresAt }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    catch (error) {
        if (outputPath) await del(outputPath).catch(() => {});
        throw error;
    }
    finally {
        if (inputPaths.length) await del(inputPaths).catch(() => {});
    }
}

export async function deleteTemporaryFileRequest(request) {
    const payload = await request.json();
    if (!payload || typeof payload.pathname !== "string" || !/^celi-(?:input|output)\/[0-9a-f-]{36}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,200}$/i.test(payload.pathname)) {
        throw new FileBackendError("Hasil sementara tidak valid.");
    }
    await del(payload.pathname);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
export function fileErrorResponse(error) {
    const known = error instanceof FileBackendError;
    return Response.json({ error: known ? error.message : "File belum dapat diproses. Coba kembali atau gunakan file yang lebih kecil." }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
