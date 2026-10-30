import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FILE_LIMITS, converterGroup, validateSelection } from "./file-tools.mjs";

export class FileBackendError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type WorkerResult = { ok: boolean; error?: string; path?: string; name?: string; notes?: string[]; engines?: Record<string, boolean> };
const shared = globalThis as typeof globalThis & { fileToolsActive?: number; fileToolsCapabilities?: { until: number; result: WorkerResult } };

function pythonPath() {
  if (process.env.FILE_TOOLS_PYTHON) return process.env.FILE_TOOLS_PYTHON;
  const local = path.join(process.cwd(), ".file-tools", "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return existsSync(local) ? local : process.platform === "win32" ? "python" : "python3";
}

function runWorker(args: string[], timeout = 240_000): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(), [path.join(process.cwd(), "server/file_worker.py"), ...args], {
      shell: false, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // Kill only this job and its descendants; media/Office are worker children.
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, shell: false });
        killer.on("error", () => child.kill());
      } else { child.kill("SIGTERM"); setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3000).unref(); }
    }, timeout);
    child.stdout.on("data", chunk => { if (stdout.length < 1_000_000) stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { if (stderr.length < 4000) stderr += chunk.toString(); });
    child.on("error", () => { clearTimeout(timer); reject(new FileBackendError("Engine file belum siap. Jalankan setup backend sesuai README.", 503)); });
    child.on("close", () => {
      clearTimeout(timer);
      if (timedOut) { reject(new FileBackendError("Proses melewati batas 4 menit. Kurangi jumlah/ukuran file dan coba lagi.", 408)); return; }
      try {
        const line = stdout.trim().split(/\r?\n/).at(-1) || "";
        const result = JSON.parse(line) as WorkerResult;
        if (!result.ok) reject(new FileBackendError(result.error || "File tidak dapat diproses."));
        else resolve(result);
      } catch (error) {
        if (error instanceof FileBackendError) reject(error);
        else {
          console.error("File worker could not return a valid result:", stderr.slice(0, 400));
          reject(new FileBackendError("Engine pemrosesan belum siap atau berhenti. Coba lagi.", 503));
        }
      }
    });
  });
}

export async function fileCapabilities() {
  if (shared.fileToolsCapabilities && shared.fileToolsCapabilities.until > Date.now()) return shared.fileToolsCapabilities.result;
  const result = await runWorker(["--capabilities"], 20_000);
  shared.fileToolsCapabilities = { result, until: Date.now() + 60_000 };
  return result;
}

function safeName(name: string, index: number) {
  const base = name.replaceAll("\\", "/").split("/").at(-1) || "file";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/, "").slice(-140) || "file";
  return `${index + 1}-${cleaned}`;
}

export async function processFileRequest(request: Request, mode: "convert" | "compress") {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new FileBackendError("Permintaan lintas situs tidak diizinkan.", 403);
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > FILE_LIMITS.maxBytes + 1024 * 1024) throw new FileBackendError("Upload membutuhkan Content-Length dan maksimum 100 MB.", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new FileBackendError("Upload harus berupa multipart/form-data.", 415);
  if ((shared.fileToolsActive || 0) >= 2) throw new FileBackendError("Server sedang memproses file lain. Coba kembali sebentar lagi.", 429);
  shared.fileToolsActive = (shared.fileToolsActive || 0) + 1;
  let directory: string | undefined;
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const target = String(form.get("target") || "");
    const preset = String(form.get("preset") || "balanced");
    if (!["small", "balanced", "quality"].includes(preset)) throw new FileBackendError("Preset tidak valid.");
    const capabilities = await fileCapabilities();
    const message = validateSelection(files, mode, target, capabilities.engines);
    if (message) throw new FileBackendError(message);
    if (request.signal.aborted) throw new FileBackendError("Upload dibatalkan.", 499);
    const root = path.join(process.cwd(), ".file-tools", "jobs");
    await mkdir(root, { recursive: true });
    directory = await mkdtemp(path.join(root, "job-"));
    const uploaded = [];
    for (const [index, file] of files.entries()) {
      const name = safeName(file.name, index);
      const destination = path.join(directory, name);
      await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
      uploaded.push({ path: destination, safeName: name, group: converterGroup(file.name)?.id || "archive" });
    }
    const jobPath = path.join(directory, "job.json");
    await writeFile(jobPath, JSON.stringify({ mode, target, preset, directory, files: uploaded }));
    const result = await runWorker([jobPath]);
    if (!result.path || !result.name || !path.resolve(result.path).startsWith(directory + path.sep)) throw new FileBackendError("Hasil engine tidak valid.", 500);
    const info = await stat(result.path);
    if (info.size > FILE_LIMITS.maxOutputBytes) throw new FileBackendError("Hasil melebihi batas 200 MB.", 413);
    const content = await readFile(result.path);
    return new Response(content, {
      headers: {
        "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`,
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "X-File-Notes": Buffer.from(JSON.stringify(result.notes || [])).toString("base64"),
        "X-Original-Bytes": String(files.reduce((sum, file) => sum + file.size, 0)),
        "Content-Length": String(content.byteLength),
      },
    });
  } finally {
    if (directory) {
      // The worker uses short OS-temp profiles for Windows path compatibility.
      // Keep their manifest in the job so timeout/crash cleanup also removes them.
      try {
        const profiles: unknown = JSON.parse(await readFile(path.join(directory, "office-profiles.json"), "utf8"));
        if (Array.isArray(profiles)) for (const profile of profiles.slice(0, 30)) {
          if (typeof profile === "string" && path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && /^cf-[a-z0-9_]{8}$/.test(path.basename(profile))) {
            await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("Could not clean an Office job profile.");
      }
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch(() => console.error("Could not remove a file processing job directory."));
    }
    shared.fileToolsActive = Math.max(0, (shared.fileToolsActive || 1) - 1);
  }
}

export function fileErrorResponse(error: unknown) {
  const known = error instanceof FileBackendError;
  return Response.json({ error: known ? error.message : "File belum dapat diproses. Coba kembali atau gunakan file yang lebih kecil." }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
