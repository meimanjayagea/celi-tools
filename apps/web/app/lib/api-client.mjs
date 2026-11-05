import { faker } from '@faker-js/faker';
import { POSTMAN_DYNAMIC_VARIABLES } from './api-dynamic-variable-catalog.mjs';

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
export function parseCurl(text, { server = false } = {}) {
  const args = tokenizeCurl(text.trim());
  if (args.shift() !== "curl") throw new Error("Perintah harus dimulai dengan curl.");
  const result = { name: "cURL", method: "GET", url: "", headers: [], body: "" };
  const ignoredHeaders = new Map();
  const ignoreHeader = name => ignoredHeaders.set(name.toLowerCase(), name.toLowerCase() === "cookie" ? "Cookie" : name);
  let explicitMethod = false, hasBody = false;
  const next = (i, option) => { if (i + 1 >= args.length) throw new Error(`Nilai ${option} tidak tersedia.`); return args[i + 1]; };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["-X", "--request"].includes(arg)) { result.method = next(i++, arg).toUpperCase(); explicitMethod = true; }
    else if (arg.startsWith("-X") && arg.length > 2) { result.method = arg.slice(2).toUpperCase(); explicitMethod = true; }
    else if (["-H", "--header"].includes(arg)) {
      const header = next(i++, arg), separator = header.indexOf(":");
      if (separator <= 0) throw new Error("Format header cURL tidak valid.");
      const key = header.slice(0, separator).trim(), lower = key.toLowerCase();
      if (!server && (FORBIDDEN_HEADERS.has(lower) || lower === "user-agent" || /^(sec-|proxy-)/i.test(key))) ignoreHeader(key);
      else result.headers.push({ key, value: header.slice(separator + 1).trim() });
    } else if (["-b", "--cookie"].includes(arg)) {
      const value = next(i++, arg);
      if (server) { if (!value.includes("=")) throw new Error("Impor cookie dari file tidak didukung."); result.headers.push({ key: "Cookie", value }); }
      else ignoreHeader("Cookie");
    } else if ((arg.startsWith("-b") && arg.length > 2) || arg.startsWith("--cookie=")) {
      const value = arg.startsWith("--cookie=") ? arg.slice(9) : arg.slice(2);
      if (server) { if (!value.includes("=")) throw new Error("Impor cookie dari file tidak didukung."); result.headers.push({ key: "Cookie", value }); }
      else ignoreHeader("Cookie");
    } else if (["-d", "--data", "--data-raw", "--data-binary", "--json"].includes(arg)) {
      if (hasBody) throw new Error("Beberapa opsi body cURL tidak didukung.");
      result.body = next(i++, arg); hasBody = true;
      if (result.body.startsWith("@")) throw new Error("Impor body dari path file tidak didukung.");
      if (arg === "--json" && !result.headers.some(h => h.key.toLowerCase() === "content-type")) result.headers.push({ key: "Content-Type", value: "application/json" });
    } else if (arg === "--url") { if (result.url) throw new Error("Hanya satu URL dapat diimpor."); result.url = next(i++, arg); }
    else if (arg === "--compressed" && server) { if (!result.headers.some(h => h.key.toLowerCase() === "accept-encoding")) result.headers.push({ key: "Accept-Encoding", value: "gzip, deflate, br" }); }
    else if (["-L", "--location"].includes(arg) && server) throw new Error("Redirect otomatis tidak didukung di mode server. Kirim ulang ke URL tujuan secara manual.");
    else if (["-L", "--location", "-s", "--silent", "--compressed"].includes(arg)) { /* Browser follows redirects and negotiates compression. */ }
    else if (arg.startsWith("-")) throw new Error(`Opsi cURL ${arg} tidak didukung.`);
    else { if (result.url) throw new Error("Hanya satu URL dapat diimpor."); result.url = arg; }
  }
  if (!result.url) throw new Error("URL cURL tidak tersedia.");
  if (hasBody && !explicitMethod) result.method = "POST";
  if (!METHODS.has(result.method)) throw new Error("Metode cURL tidak didukung.");
  if (ignoredHeaders.size) result.ignoredHeaders = [...ignoredHeaders.values()];
  return result;
}

/** Recognize cURL pasted into the URL field without executing shell input. */
export function parseCurlPaste(text, options) {
  if (!/^\s*curl(?:\s|$)/.test(text)) return null;
  if (new TextEncoder().encode(text).byteLength > 1024 * 1024) throw new Error("Impor dibatasi hingga 1 MB.");
  const request = parseCurl(text, options);
  let url;
  try { url = new URL(request.url); } catch { throw new Error("Masukkan URL lengkap yang valid."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("URL harus menggunakan HTTP atau HTTPS tanpa kredensial dalam alamat.");
  return request;
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

/** Apply explicit authentication to a request without persisting credentials. */
export function applyAuthorization(request, auth) {
  const output = { ...request, headers: request.headers.map(row => ({ ...row })) };
  if (!auth || auth.type === 'none') return output;
  if (auth.type === 'api-key' && auth.placement === 'query') {
    if (!auth.key?.trim() || !auth.value) throw new Error('Isi nama dan nilai API key.');
    const url = new URL(output.url); url.searchParams.set(auth.key, auth.value); output.url = url.toString(); return output;
  }
  const name = auth.type === 'api-key' ? auth.key?.trim() : 'Authorization';
  const value = auth.type === 'bearer' ? `Bearer ${auth.token || ''}` : auth.type === 'basic' ? `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${auth.username || ''}:${auth.password || ''}`)))}` : auth.value;
  if (!name || !value || (auth.type === 'bearer' && !auth.token)) throw new Error('Lengkapi data authorization.');
  if (output.headers.some(row => row.key.trim().toLowerCase() === name.toLowerCase())) throw new Error(`Header ${name} sudah ada. Hapus duplikat sebelum mengirim.`);
  output.headers.push({ key: name, value }); return output;
}

/** Remove common secrets from a request before saving it to browser storage. */
export function sanitizeSavedRequest(request) {
  const sensitive = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key|access[-_]?token|token|secret|password)$/i;
  let url = request.url;
  try { const parsed = new URL(url); parsed.username = ''; parsed.password = ''; for (const key of [...parsed.searchParams.keys()]) if (sensitive.test(key)) parsed.searchParams.delete(key); url = parsed.toString().replace(/%7B%7B([\w.-]+)%7D%7D/gi, "{{$1}}"); } catch { /* Preserve incomplete URLs without userinfo. */ url = url.replace(/^(https?:\/\/)[^/@]+@/i, '$1'); }
  return { name: String(request.name || 'Request'), method: request.method, url, headers: request.headers.filter(row => !sensitive.test(row.key.trim())).map(row => ({ key: row.key, value: row.value })), body: request.body || '' };
}

/** Replace named in-memory variables; unknown names remain visible for correction. */
export function createDynamicVariables(now = new Date()) {
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const localdate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const pick = values => faker.helpers.arrayElement(values);
  const firstName = () => faker.person.firstName();
  const lastName = () => faker.person.lastName();
  const word = () => faker.word.sample();
  const color = () => faker.color.human();
  const date = value => value.toISOString();
  const image = () => faker.image.url({ width: 640, height: 480 });
  const variables = {
    '$guid': () => crypto.randomUUID(),
    '$timestamp': () => timestamp,
    '$isoTimestamp': () => now.toISOString(),
    '$randomInt': () => String(faker.number.int({ min: 0, max: 1000 })),
    '$randomPhoneNumber': () => faker.phone.number({ style: 'national' }),
    '$randomPhoneNumberExt': () => `${faker.number.int({ min: 10, max: 99 })}-${faker.phone.number({ style: 'national' })}`,
    '$randomLocale': () => pick(['en', 'id', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'pt', 'zh']),
    '$randomWords': () => faker.lorem.words(faker.number.int({ min: 2, max: 5 })),
    '$randomFilePath': () => faker.system.filePath(),
    '$randomDirectoryPath': () => faker.system.directoryPath(),
    '$randomCity': () => faker.location.city(),
    '$randomStreetName': () => faker.location.street(),
    '$randomStreetAddress': () => faker.location.streetAddress(),
    '$randomCountry': () => faker.location.country(),
    '$randomCountryCode': () => faker.location.countryCode(),
    '$randomLatitude': () => faker.location.latitude({ precision: 4 }),
    '$randomLongitude': () => faker.location.longitude({ precision: 4 }),
    '$randomColor': color,
    '$randomDepartment': () => faker.commerce.department(),
    '$randomProductName': () => faker.commerce.productName(),
    '$randomProductAdjective': () => faker.commerce.productAdjective(),
    '$randomProductMaterial': () => faker.commerce.productMaterial(),
    '$randomProduct': () => faker.commerce.product(),
    '$randomCompanyName': () => faker.company.name(),
    '$randomCompanySuffix': () => faker.company.name().split(' ').at(-1),
    '$randomCatchPhrase': () => faker.company.catchPhrase(),
    '$randomBs': () => faker.company.buzzPhrase(),
    '$randomCatchPhraseAdjective': () => faker.company.catchPhraseAdjective(),
    '$randomCatchPhraseDescriptor': () => faker.company.catchPhraseDescriptor(),
    '$randomCatchPhraseNoun': () => faker.company.catchPhraseNoun(),
    '$randomBsAdjective': () => faker.company.buzzAdjective(),
    '$randomBsBuzz': () => faker.company.buzzVerb(),
    '$randomBsNoun': () => faker.company.buzzNoun(),
    '$randomDatabaseColumn': () => pick(['id', 'createdAt', 'updatedAt', 'email', 'status', 'name', 'token', 'group']),
    '$randomDatabaseType': () => pick(['integer', 'bigint', 'varchar', 'text', 'boolean', 'timestamp', 'decimal', 'jsonb']),
    '$randomDatabaseCollation': () => pick(['utf8_bin', 'utf8_general_ci', 'utf8mb4_unicode_ci', 'en_US.utf8']),
    '$randomDatabaseEngine': () => pick(['InnoDB', 'PostgreSQL', 'SQLite', 'Memory', 'Archive']),
    '$randomDatePast': () => date(faker.date.past({ refDate: now })),
    '$randomDateFuture': () => date(faker.date.future({ refDate: now })),
    '$randomDateRecent': () => date(faker.date.recent({ refDate: now })),
    '$randomMonth': () => faker.date.month(),
    '$randomWeekday': () => faker.date.weekday(),
    '$randomBankAccount': () => faker.finance.accountNumber({ length: 8 }),
    '$randomBankAccountName': () => `${pick(['Savings', 'Checking', 'Business', 'Everyday'])} Account`,
    '$randomCreditCardMask': () => `**** **** **** ${faker.string.numeric(4)}`,
    '$randomPrice': () => faker.commerce.price({ min: 0, max: 1000, dec: 2 }),
    '$randomTransactionType': () => faker.finance.transactionType(),
    '$randomCurrencyCode': () => faker.finance.currencyCode(),
    '$randomCurrencyName': () => faker.finance.currencyName(),
    '$randomCurrencySymbol': () => faker.finance.currencySymbol(),
    '$randomBitcoin': () => faker.finance.bitcoinAddress(),
    '$randomBankAccountIban': () => faker.finance.iban(),
    '$randomBankAccountBic': () => faker.finance.bic(),
    '$randomAbbreviation': () => faker.word.adjective().slice(0, 3).toUpperCase(),
    '$randomAdjective': () => faker.word.adjective(),
    '$randomNoun': () => faker.word.noun(),
    '$randomVerb': () => faker.word.verb(),
    '$randomIngverb': () => `${faker.word.verb()}ing`,
    '$randomPhrase': () => faker.hacker.phrase(),
    '$randomAvatarImage': () => faker.image.avatar(),
    '$randomImageUrl': () => faker.image.url(),
    '$randomAbstractImage': () => image('abstract'),
    '$randomAnimalsImage': () => image('animals'),
    '$randomBusinessImage': () => image('business'),
    '$randomCatsImage': () => image('cats'),
    '$randomCityImage': () => image('city'),
    '$randomFoodImage': () => image('food'),
    '$randomNightlifeImage': () => image('nightlife'),
    '$randomFashionImage': () => image('fashion'),
    '$randomPeopleImage': () => image('people'),
    '$randomNatureImage': () => image('nature'),
    '$randomSportsImage': () => image('sports'),
    '$randomTransportImage': () => image('transport'),
    '$randomImageDataUri': () => faker.image.dataUri({ type: 'svg-base64' }),
    '$randomEmail': () => faker.internet.email(),
    '$randomExampleEmail': () => `${firstName().toLowerCase()}.${lastName().toLowerCase()}@example.com`,
    '$randomUserName': () => faker.internet.username(),
    '$randomProtocol': () => pick(['http', 'https']),
    '$randomUrl': () => faker.internet.url(),
    '$randomDomainName': () => faker.internet.domainName(),
    '$randomDomainSuffix': () => `.${faker.internet.domainName().split('.').at(-1)}`,
    '$randomDomainWord': () => faker.internet.domainWord(),
    '$randomIP': () => faker.internet.ipv4(),
    '$randomIPV6': () => faker.internet.ipv6(),
    '$randomUserAgent': () => faker.internet.userAgent(),
    '$randomHexColor': () => faker.color.rgb({ format: 'hex' }),
    '$randomMACAddress': () => faker.internet.mac(),
    '$randomPassword': () => faker.internet.password({ length: 15 }),
    '$randomLoremWord': () => faker.lorem.word(),
    '$randomLoremWords': () => faker.lorem.words(3),
    '$randomLoremSentence': () => faker.lorem.sentence(),
    '$randomLoremSlug': () => faker.helpers.slugify(faker.lorem.words(3)).toLowerCase(),
    '$randomLoremSentences': () => faker.lorem.sentences({ min: 2, max: 6 }),
    '$randomLoremParagraph': () => faker.lorem.paragraph(),
    '$randomLoremParagraphs': () => faker.lorem.paragraphs(3),
    '$randomLoremText': () => faker.lorem.text(),
    '$randomLoremLines': () => faker.lorem.lines(faker.number.int({ min: 1, max: 5 })),
    '$randomFirstName': firstName,
    '$randomLastName': lastName,
    '$randomFullName': () => faker.person.fullName(),
    '$randomJobTitle': () => faker.person.jobTitle(),
    '$randomNamePrefix': () => faker.person.prefix(),
    '$randomNameSuffix': () => faker.person.suffix(),
    '$randomJobDescriptor': () => faker.person.jobDescriptor(),
    '$randomJobArea': () => faker.person.jobArea(),
    '$randomJobType': () => faker.person.jobType(),
    '$randomUUID': () => crypto.randomUUID(),
    '$randomBoolean': () => String(faker.datatype.boolean()),
    '$randomWord': word,
    '$randomAlphaNumeric': () => faker.string.alphanumeric(1),
    '$randomFileName': () => faker.system.fileName(),
    '$randomCommonFileName': () => faker.system.commonFileName(),
    '$randomMimeType': () => faker.system.mimeType(),
    '$randomCommonFileType': () => faker.system.commonFileType(),
    '$randomCommonFileExt': () => faker.system.commonFileExt(),
    '$randomFileType': () => faker.system.fileType(),
    '$randomFileExt': () => faker.system.fileExt(),
    '$randomSemver': () => faker.system.semver(),
  };
  const generated = Object.fromEntries(POSTMAN_DYNAMIC_VARIABLES.map(({ name }) => [name, String(variables[name]())]));
  return { ...generated, timestamp, timestemp: timestamp, '$timestamp': timestamp, localdate, '$isoTimestamp': now.toISOString(), '$guid': crypto.randomUUID() };
}

export { POSTMAN_DYNAMIC_VARIABLES };

export function resolveApiVariables(text, variables) {
  return text.replace(/\{\{(\$?[\w.-]+)\}\}/g, (whole, key) => Object.hasOwn(variables, key) ? variables[key] : whole);
}

/** Execute a deliberately small Postman-style statement subset, never JavaScript. */
export function runApiScript(script, variables, response) {
  const next = { ...variables }, tests = [];
  for (const statement of script.split(/\n/).map(line => line.trim()).filter(Boolean)) {
    let match = statement.match(/^pm\.environment\.set\(\s*(["'])([\w.-]+)\1\s*,\s*(["'])(.*?)\3\s*\);?$/);
    if (match) { next[match[2]] = match[4]; continue; }
    match = statement.match(/^pm\.test\(\s*(["'])(.*?)\1\s*,\s*\(\)\s*=>\s*pm\.response\.to\.have\.status\((\d{3})\)\s*\);?$/);
    if (match && response) { tests.push({ name: match[2], passed: response.status === Number(match[3]) }); continue; }
    match = statement.match(/^pm\.test\(\s*(["'])(.*?)\1\s*,\s*\(\)\s*=>\s*pm\.expect\(pm\.response\.json\(\)((?:\.[\w-]+)+)\)\.to\.eql\((.*?)\)\s*\);?$/);
    if (match && response) {
      let actual; try { actual = JSON.parse(response.text); for (const key of match[3].slice(1).split('.')) actual = actual?.[key]; } catch { actual = undefined; }
      let expected; try { expected = JSON.parse(match[4]); } catch { throw new Error('Nilai ekspektasi harus berupa JSON.'); }
      tests.push({ name: match[2], passed: JSON.stringify(actual) === JSON.stringify(expected) }); continue;
    }
    throw new Error('Baris skrip tidak didukung. Gunakan contoh yang tersedia.');
  }
  return { variables: next, tests };
}
