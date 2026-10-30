import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env", "src/server.mjs"], { cwd: path.join(root, "apps/api"), stdio: "inherit", windowsHide: true }),
  spawn(process.execPath, [fileURLToPath(import.meta.resolve("next/dist/bin/next")), "dev"], { cwd: path.join(root, "apps/web"), stdio: "inherit", windowsHide: true }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill("SIGTERM"));
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
children.forEach(child => {
  child.on("error", error => { console.error(error.message); stop(1); });
  child.on("exit", code => { if (!stopping) stop(code ?? 1); });
});
