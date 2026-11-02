const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);
const FORBIDDEN_HEADERS = new Set(["accept-charset", "accept-encoding", "access-control-request-headers", "access-control-request-method", "connection", "content-length", "cookie", "date", "dnt", "expect", "host", "keep-alive", "origin", "referer", "te", "trailer", "transfer-encoding", "upgrade", "via"]);

/** Replace a URL's query with ordered key-value pairs while preserving its fragment. */
export function replaceQuery(url, rows) {
  const parsed = new URL(url);
  parsed.search = "";
  for (const row of rows) if (row.key.trim()) parsed.searchParams.append(row.key, row.value);
  return parsed.toString();
}

/** Validate a request before handing it to the browser fetch implementation. */
export function validateRequest(request) {
  const method = String(request.method || "").toUpperCase();
  if (!METHODS.has(method)) throw new Error("Metode request tidak didukung.");
  let url;
  try { url = new URL(request.url.trim()); } catch { throw new Error("Masukkan URL lengkap yang valid."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("URL harus menggunakan HTTP atau HTTPS tanpa kredensial dalam alamat.");
  const headers = new Headers();
  for (const row of request.headers) {
    const key = row.key.trim();
    if (!key && !row.value) continue;
    if (!key || FORBIDDEN_HEADERS.has(key.toLowerCase()) || /^(sec-|proxy-)/i.test(key)) throw new Error(`Header ${key || "tanpa nama"} tidak dapat dikirim oleh browser.`);
    try { headers.append(key, row.value); } catch { throw new Error(`Header ${key} tidak valid.`); }
  }
  const body = request.body || "";
  if (body.trim()) {
    if (method === "GET") throw new Error("GET tidak mendukung request body di browser.");
    try { JSON.parse(body); } catch { throw new Error("Body harus berupa JSON yang valid."); }
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  return { url: url.toString(), method, headers, body: body.trim() ? body : undefined };
}

/** Send a validated request and read at most 2 MiB of response data. */
export async function executeApiRequest(request, signal) {
  const start = performance.now();
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, credentials: "omit", referrerPolicy: "no-referrer", signal });
  let bytes = 0, text = "", truncated = false;
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const limit = 2 * 1024 * 1024;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = limit - bytes;
        if (value.byteLength > remaining) {
          text += decoder.decode(value.subarray(0, remaining), { stream: true });
          bytes += remaining;
          truncated = true;
          await reader.cancel();
          break;
        }
        bytes += value.byteLength;
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
  }
  if (!truncated && text) {
    try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* Plain text is displayed unchanged. */ }
  }
  return { status: response.status, statusText: response.statusText, milliseconds: Math.round(performance.now() - start), bytes, text, truncated };
}

function tokenizeCurl(text) {
  const input = text.replace(/\\\r?\n/g, " ");
  const words = [];
  let word = "", quote = "", started = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote === "'") {
      if (char === "'") quote = ""; else word += char;
    } else if (quote === '"') {
      if (char === '"') quote = "";
      else if (char === "\\" && i + 1 < input.length && /["\\$`]/.test(input[i + 1])) word += input[++i];
      else word += char;
    } else if (char === "'" || char === '"') { quote = char; started = true; }
    else if (char === "\\") { if (++i >= input.length) throw new Error("cURL berakhir dengan escape yang tidak lengkap."); word += input[i]; started = true; }
    else if (/\s/.test(char)) { if (started) { words.push(word); word = ""; started = false; } }
    else if (/[|;&<>`]/.test(char)) throw new Error("Operator shell tidak didukung saat impor cURL.");
    else { word += char; started = true; }
  }
  if (quote) throw new Error("Tanda kutip cURL belum ditutup.");
  if (started) words.push(word);
  return words;
}

/** Parse supported cURL request options as data; never execute a shell command. */
export function parseCurl(text) {
  const args = tokenizeCurl(text.trim());
  if (args.shift() !== "curl") throw new Error("Perintah harus dimulai dengan curl.");
  const result = { name: "cURL", method: "GET", url: "", headers: [], body: "" };
  let explicitMethod = false, hasBody = false;
  const next = (i, option) => { if (i + 1 >= args.length) throw new Error(`Nilai ${option} tidak tersedia.`); return args[i + 1]; };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["-X", "--request"].includes(arg)) { result.method = next(i++, arg).toUpperCase(); explicitMethod = true; }
    else if (arg.startsWith("-X") && arg.length > 2) { result.method = arg.slice(2).toUpperCase(); explicitMethod = true; }
    else if (["-H", "--header"].includes(arg)) {
      const header = next(i++, arg), separator = header.indexOf(":");
      if (separator <= 0) throw new Error("Format header cURL tidak valid.");
      result.headers.push({ key: header.slice(0, separator).trim(), value: header.slice(separator + 1).trim() });
    } else if (["-d", "--data", "--data-raw", "--data-binary", "--json"].includes(arg)) {
      if (hasBody) throw new Error("Beberapa opsi body cURL tidak didukung.");
      result.body = next(i++, arg); hasBody = true;
      if (result.body.startsWith("@")) throw new Error("Impor body dari path file tidak didukung.");
      if (arg === "--json" && !result.headers.some(h => h.key.toLowerCase() === "content-type")) result.headers.push({ key: "Content-Type", value: "application/json" });
    } else if (arg === "--url") { if (result.url) throw new Error("Hanya satu URL dapat diimpor."); result.url = next(i++, arg); }
    else if (["-L", "--location", "-s", "--silent", "--compressed"].includes(arg)) { /* Browser follows redirects and negotiates compression. */ }
    else if (arg.startsWith("-")) throw new Error(`Opsi cURL ${arg} tidak didukung.`);
    else { if (result.url) throw new Error("Hanya satu URL dapat diimpor."); result.url = arg; }
  }
  if (!result.url) throw new Error("URL cURL tidak tersedia.");
  if (hasBody && !explicitMethod) result.method = "POST";
  if (!METHODS.has(result.method)) throw new Error("Metode cURL tidak didukung.");
  return result;
}

function pairs(value) {
  if (Array.isArray(value)) return value.filter(item => item && !item.disabled && typeof item.key === "string").map(item => ({ key: item.key, value: String(item.value ?? "") }));
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => ({ key, value: String(item ?? "") }));
  return [];
}

function normalizeJsonRequest(input, name) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Format request JSON tidak valid.");
  if (input.auth && input.auth.type !== "noauth") throw new Error("Autentikasi Postman belum didukung; isi header Authorization secara manual.");
  const method = String(input.method || "GET").toUpperCase();
  if (!METHODS.has(method)) throw new Error(`Metode ${method} tidak didukung.`);
  const sourceUrl = input.url;
  let url = typeof sourceUrl === "string" ? sourceUrl : sourceUrl?.raw;
  if (typeof url !== "string" || !url.trim()) throw new Error("URL request JSON tidak tersedia.");
  const query = input.query ?? (typeof sourceUrl === "object" ? sourceUrl?.query : null);
  if (query != null) {
    try { url = replaceQuery(url, pairs(query)); } catch { throw new Error("URL request JSON tidak valid."); }
  }
  let body = "";
  if (typeof input.body === "string") body = input.body;
  else if (input.body && typeof input.body === "object") {
    if ("mode" in input.body) {
      if (input.body.mode !== "raw") throw new Error("Hanya body raw JSON yang didukung.");
      body = String(input.body.raw ?? "");
    } else body = JSON.stringify(input.body, null, 2);
  }
  return { name: String(name || input.name || "Request"), method, url, headers: pairs(input.header ?? input.headers), body };
}

/** Import one request or a Postman collection, retaining each request separately. */
export function parseRequestJson(text) {
  let root;
  try { root = JSON.parse(text); } catch { throw new Error("File impor bukan JSON yang valid."); }
  const requests = [];
  function collect(item) {
    if (!item || typeof item !== "object" || requests.length >= 1000) throw new Error("Koleksi JSON tidak valid atau terlalu besar.");
    if (item.auth && item.auth.type !== "noauth") throw new Error("Autentikasi Postman belum didukung; isi header Authorization secara manual.");
    if (Array.isArray(item.item)) { for (const child of item.item) collect(child); }
    else requests.push(normalizeJsonRequest(item.request || item, item.name));
  }
  if (Array.isArray(root)) root.forEach(collect); else collect(root);
  if (!requests.length) throw new Error("Tidak ada request dalam JSON.");
  return requests;
}
