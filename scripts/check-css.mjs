// Lists class names used in app/**/*.tsx that have no matching rule in app/globals.css.
// Usage: npm run check:css
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync("app/globals.css", "utf8");

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
};

const files = walk("app");
const used = new Set();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  // className="..." (string literal)
  for (const m of text.matchAll(/className="([^"]*)"/g)) {
    m[1].split(/\s+/).forEach((c) => c && used.add(c));
  }
  // className={`...`} template literal
  for (const m of text.matchAll(/className=\{`([^`]*)`\}/g)) {
    m[1].split(/\s+/).forEach((c) => c && used.add(c));
  }
  // className={"..."} string in braces
  for (const m of text.matchAll(/className=\{"([^"]*)"\}/g)) {
    m[1].split(/\s+/).forEach((c) => c && used.add(c));
  }
}

const clean = [...used].filter((c) => /^[a-zA-Z][\w-]*$/.test(c));
const missing = clean.filter((c) => !css.includes("." + c));

console.log("FILES SCANNED:", files.length);
console.log("CLASSES USED:", clean.length);
console.log("MISSING FROM CSS:", missing.length);
console.log(missing.join("\n"));
