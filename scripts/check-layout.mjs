import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const failures = [];

async function requireFile(relativePath) {
  try {
    await stat(path.join(repositoryRoot, relativePath));
  } catch {
    failures.push(`Missing repository path: ${relativePath}`);
  }
}

function resolveInsideRepository(label, relativePath) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    failures.push(`${label} must be a relative path.`);
    return null;
  }
  const resolved = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) {
    failures.push(`${label} escapes the repository root.`);
    return null;
  }
  return resolved;
}

const requiredPaths = [
  "package.json",
  "package-lock.json",
  "vercel.json",
  "railway.json",
  "Dockerfile.api",
  "apps/web/package.json",
  "apps/api/package.json",
  "apps/web/db/migrate.mjs",
  "apps/web/db/migrations/001_auth.sql",
  "apps/web/db/migrations/002_sticky_notes.sql",
];
for (const file of requiredPaths) await requireFile(file);

try {
  const config = JSON.parse(await readFile(path.join(repositoryRoot, "vercel.json"), "utf8"));
  const services = config.services;
  if (!services || typeof services !== "object") {
    failures.push("vercel.json must define services at the repository root.");
  } else {
    const frontend = services.frontend;
    const backend = services.backend;
    for (const [name, service] of Object.entries(services)) {
      const serviceRoot = resolveInsideRepository(`Vercel service ${name}.root`, service.root);
      if (serviceRoot) await requireFile(path.relative(repositoryRoot, serviceRoot));
    }
    if (frontend) {
      const frontendRoot = resolveInsideRepository("Vercel frontend root", frontend.root);
      if (frontendRoot) await requireFile(path.relative(repositoryRoot, path.join(frontendRoot, "package.json")));
      const installPrefix = /npm ci --prefix\s+([^\s]+)/.exec(frontend.installCommand || "")?.[1];
      if (!installPrefix || path.resolve(frontendRoot || repositoryRoot, installPrefix) !== repositoryRoot) {
        failures.push("Frontend installCommand must resolve the shared npm lockfile from the repository root.");
      }
    }
    if (backend) {
      const backendRoot = resolveInsideRepository("Vercel backend root", backend.root);
      const entrypoint = backendRoot && path.resolve(backendRoot, backend.entrypoint || "");
      if (entrypoint) await requireFile(path.relative(repositoryRoot, entrypoint));
    }
    const serviceNames = new Set(Object.keys(services));
    for (const rewrite of config.rewrites || []) {
      const destination = rewrite.destination;
      if (destination && typeof destination === "object" && !serviceNames.has(destination.service)) {
        failures.push(`Rewrite ${rewrite.source} references missing service ${destination.service}.`);
      }
    }
  }
} catch (error) {
  failures.push(`Could not validate vercel.json: ${error.message}`);
}

try {
  const railway = JSON.parse(await readFile(path.join(repositoryRoot, "railway.json"), "utf8"));
  const dockerfile = resolveInsideRepository("Railway Dockerfile path", railway.build?.dockerfilePath);
  if (dockerfile) await requireFile(path.relative(repositoryRoot, dockerfile));
} catch (error) {
  failures.push(`Could not validate railway.json: ${error.message}`);
}

if (failures.length) {
  failures.forEach(error => console.error(`FAIL ${error}`));
  process.exitCode = 1;
} else {
  console.log("Deployment roots, entrypoints, shared install path, and migration files are present.");
}
