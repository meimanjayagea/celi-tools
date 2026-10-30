import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const python = process.env.FILE_TOOLS_PYTHON || path.resolve(".file-tools/venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) throw new Error("File backend belum disiapkan. Ikuti bagian File Tools Backend di README.");
const child = spawn(python, ["server/test_file_worker.py", ...process.argv.slice(2)], { stdio: "inherit", shell: false, env: { ...process.env, PYTHONUTF8: "1" } });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
