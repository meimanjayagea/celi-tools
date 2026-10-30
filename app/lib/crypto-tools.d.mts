export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type HmacAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

export function utf8Encode(text: string): Uint8Array;
export function utf8Decode(bytes: Uint8Array): string;
export function bytesToBase64(bytes: Uint8Array, options?: { urlSafe?: boolean }): string;
export function base64ToBytes(input: string): Uint8Array;
export function base64Encode(text: string, options?: { urlSafe?: boolean }): string;
export function base64Decode(encoded: string): string;
export function bytesToHex(bytes: Uint8Array): string;
export function toHex(text: string): string;
export function fromHex(hex: string): string;
export function toBinary(text: string): string;
export function fromBinary(binary: string): string;
export function urlEncode(text: string): string;
export function urlDecode(text: string): string;
export function caesarCipher(text: string, shift: number, decrypt?: boolean): string;
export function rot13(text: string): string;

export const HASH_ALGORITHMS: HashAlgorithm[];
export const WEAK_HASHES: HashAlgorithm[];
export function hashBytes(algorithm: HashAlgorithm, bytes: Uint8Array): Promise<string>;
export function hashText(algorithm: HashAlgorithm, text: string): Promise<string>;
export const HMAC_ALGORITHMS: HmacAlgorithm[];
export function hmac(algorithm: HmacAlgorithm, secret: string, message: string): Promise<string>;

export const PBKDF2_ITERATIONS: number;
export function aesEncrypt(text: string, password: string): Promise<string>;
export function aesDecrypt(ciphertext: string, password: string): Promise<string>;

export function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown>; signature: string };

export const PASSWORD_CHARSETS: Record<"lower" | "upper" | "digits" | "symbols", string>;
export function randomInt(max: number): number;
export function generatePassword(options?: {
  length?: number;
  lower?: boolean;
  upper?: boolean;
  digits?: boolean;
  symbols?: boolean;
  excludeSimilar?: boolean;
}): string;
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; bits: number; label: string };
export function generateUuids(count?: number): string[];
