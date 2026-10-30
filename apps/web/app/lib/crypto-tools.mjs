/**
 * Celi Tools — crypto, hashing and encoding utilities.
 * Everything runs locally on the Web Crypto API; nothing is sent to a server.
 * Text is always treated as UTF-8 so non-ASCII input round-trips correctly.
 */

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

export function utf8Encode(text) {
  return encoder.encode(text);
}

export function utf8Decode(bytes) {
  try {
    return strictDecoder.decode(bytes);
  } catch {
    throw new Error("Hasil bukan teks UTF-8 yang valid.");
  }
}

/* ---------- Base64 ---------- */

export function bytesToBase64(bytes, { urlSafe = false } = {}) {
  let binary = "";
  // Chunked to avoid "Maximum call stack size exceeded" on large inputs.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  const base64 = btoa(binary);
  return urlSafe ? base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") : base64;
}

export function base64ToBytes(input) {
  const normalized = input.replace(/\s+/g, "").replaceAll("-", "+").replaceAll("_", "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    throw new Error("Input bukan Base64 yang valid.");
  }
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function base64Encode(text, options) {
  return bytesToBase64(utf8Encode(text), options);
}

export function base64Decode(encoded) {
  return utf8Decode(base64ToBytes(encoded));
}

/* ---------- Hex, binary, URL ---------- */

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toHex(text) {
  return bytesToHex(utf8Encode(text));
}

export function fromHex(hex) {
  const clean = hex.replace(/0x/gi, "").replace(/[\s:,-]/g, "");
  if (!/^[0-9a-f]*$/i.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Hex harus berisi pasangan digit 0-9 dan a-f.");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  return utf8Decode(bytes);
}

export function toBinary(text) {
  return Array.from(utf8Encode(text), (byte) => byte.toString(2).padStart(8, "0")).join(" ");
}

export function fromBinary(binary) {
  const groups = binary.trim().split(/\s+/).filter(Boolean);
  if (groups.some((group) => !/^[01]{1,8}$/.test(group))) {
    throw new Error("Biner harus berupa kelompok 8 digit 0/1 yang dipisah spasi.");
  }
  return utf8Decode(Uint8Array.from(groups, (group) => parseInt(group, 2)));
}

export function urlEncode(text) {
  return encodeURIComponent(text);
}

export function urlDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    throw new Error("Teks berisi urutan %-encoding yang tidak valid.");
  }
}

/* ---------- Classic ciphers ---------- */

export function caesarCipher(text, shift, decrypt = false) {
  const amount = ((Math.trunc(Number(shift) || 0) % 26) + 26) % 26;
  const actual = decrypt ? 26 - amount : amount;
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + actual) % 26) + base);
  });
}

export function rot13(text) {
  return caesarCipher(text, 13);
}

/* ---------- Hashing ---------- */

export const HASH_ALGORITHMS = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];
export const WEAK_HASHES = ["MD5", "SHA-1"];

const MD5_SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0);

function md5(bytes) {
  const length = bytes.length;
  const total = (Math.floor((length + 8) / 64) + 1) * 64;
  const buffer = new Uint8Array(total);
  buffer.set(bytes);
  buffer[length] = 0x80;
  const view = new DataView(buffer.buffer);
  view.setUint32(total - 8, (length * 8) >>> 0, true);
  view.setUint32(total - 4, Math.floor(length / 0x20000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const words = new Uint32Array(16);
  for (let offset = 0; offset < total; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, true);
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let f;
      let g;
      if (index < 16) { f = (b & c) | (~b & d); g = index; }
      else if (index < 32) { f = (d & b) | (~d & c); g = (5 * index + 1) % 16; }
      else if (index < 48) { f = b ^ c ^ d; g = (3 * index + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * index) % 16; }
      const shift = MD5_SHIFTS[(index >> 4) * 4 + (index % 4)];
      f = (f + a + MD5_K[index] + words[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((f << shift) | (f >>> (32 - shift)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const digest = new Uint8Array(16);
  const digestView = new DataView(digest.buffer);
  [a0, b0, c0, d0].forEach((word, index) => digestView.setUint32(index * 4, word, true));
  return bytesToHex(digest);
}

export async function hashBytes(algorithm, bytes) {
  if (algorithm === "MD5") return md5(bytes);
  if (!HASH_ALGORITHMS.includes(algorithm)) throw new Error(`Algoritma tidak didukung: ${algorithm}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest(algorithm, bytes)));
}

export function hashText(algorithm, text) {
  return hashBytes(algorithm, utf8Encode(text));
}

export const HMAC_ALGORITHMS = ["SHA-256", "SHA-384", "SHA-512"];

export async function hmac(algorithm, secret, message) {
  if (!HMAC_ALGORITHMS.includes(algorithm)) throw new Error(`Algoritma tidak didukung: ${algorithm}`);
  if (!secret) throw new Error("Kunci rahasia wajib diisi.");
  const key = await crypto.subtle.importKey("raw", utf8Encode(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, utf8Encode(message))));
}

/* ---------- AES-256-GCM (password based) ---------- */

// Payload layout: version (1 byte) | salt (16) | iv (12) | ciphertext + GCM tag.
const AES_VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
export const PBKDF2_ITERATIONS = 600_000;

async function deriveAesKey(password, salt, usage) {
  const material = await crypto.subtle.importKey("raw", utf8Encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function aesEncrypt(text, password) {
  if (!password) throw new Error("Kata sandi wajib diisi.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(password, salt, "encrypt");
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8Encode(text)));
  const payload = new Uint8Array(1 + SALT_BYTES + IV_BYTES + encrypted.length);
  payload[0] = AES_VERSION;
  payload.set(salt, 1);
  payload.set(iv, 1 + SALT_BYTES);
  payload.set(encrypted, 1 + SALT_BYTES + IV_BYTES);
  return bytesToBase64(payload);
}

export async function aesDecrypt(ciphertext, password) {
  if (!password) throw new Error("Kata sandi wajib diisi.");
  const payload = base64ToBytes(ciphertext.trim());
  if (payload.length < 1 + SALT_BYTES + IV_BYTES + GCM_TAG_BYTES) throw new Error("Ciphertext terlalu pendek atau rusak.");
  if (payload[0] !== AES_VERSION) throw new Error("Format ciphertext tidak dikenali. Gunakan teks hasil enkripsi Celi Tools.");
  const salt = payload.subarray(1, 1 + SALT_BYTES);
  const iv = payload.subarray(1 + SALT_BYTES, 1 + SALT_BYTES + IV_BYTES);
  const data = payload.subarray(1 + SALT_BYTES + IV_BYTES);
  const key = await deriveAesKey(password, salt, "decrypt");
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  } catch {
    throw new Error("Gagal mendekripsi: kata sandi salah atau data telah diubah.");
  }
  return utf8Decode(new Uint8Array(decrypted));
}

/* ---------- JWT ---------- */

export function decodeJwt(token) {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("JWT harus terdiri dari 3 bagian yang dipisah titik.");
  const decodePart = (part, name) => {
    try {
      return JSON.parse(base64Decode(part));
    } catch {
      throw new Error(`Bagian ${name} JWT tidak bisa dibaca.`);
    }
  };
  return { header: decodePart(parts[0], "header"), payload: decodePart(parts[1], "payload"), signature: parts[2] };
}

/* ---------- Generators ---------- */

export const PASSWORD_CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
};
const SIMILAR_CHARACTERS = /[Il1O0o]/g;

/** Unbiased random integer in [0, max) using rejection sampling. */
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limit);
  return buffer[0] % max;
}

export function generatePassword({ length = 16, lower = true, upper = true, digits = true, symbols = true, excludeSimilar = false } = {}) {
  const size = Math.min(128, Math.max(4, Math.trunc(length)));
  const sets = Object.entries({ lower, upper, digits, symbols })
    .filter(([, enabled]) => enabled)
    .map(([name]) => (excludeSimilar ? PASSWORD_CHARSETS[name].replace(SIMILAR_CHARACTERS, "") : PASSWORD_CHARSETS[name]));
  if (!sets.length) throw new Error("Pilih minimal satu jenis karakter.");
  const pool = sets.join("");
  // Guarantee one character from each selected set, then fill and shuffle.
  const characters = sets.map((set) => set[randomInt(set.length)]);
  while (characters.length < size) characters.push(pool[randomInt(pool.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}

export function passwordStrength(password) {
  if (!password) return { score: 0, bits: 0, label: "Kosong" };
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^a-zA-Z\d]/.test(password)) pool += 33;
  const bits = Math.round(password.length * Math.log2(pool));
  const score = bits < 28 ? 0 : bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { score, bits, label: ["Sangat lemah", "Lemah", "Sedang", "Kuat", "Sangat kuat"][score] };
}

export function generateUuids(count = 1) {
  return Array.from({ length: Math.min(100, Math.max(1, Math.trunc(count))) }, () => crypto.randomUUID());
}
