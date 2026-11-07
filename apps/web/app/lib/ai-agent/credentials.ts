import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EncryptedSecret } from "./types";

function encryptionKey(): Buffer {
  const value = process.env.AI_AGENT_CREDENTIALS_ENCRYPTION_KEY || "";
  let key: Buffer;
  try { key = Buffer.from(value, "base64"); } catch { throw new Error("AI credentials encryption is not configured."); }
  if (key.length !== 32 || key.toString("base64") !== value) throw new Error("AI credentials encryption is not configured.");
  return key;
}

export function encryptProviderKey(plainText: string): EncryptedSecret {
  if (!plainText || plainText.length > 4096) throw new Error("API key is invalid.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag(), version: 1 };
}

export function decryptProviderKey(secret: EncryptedSecret): string {
  if (secret.version !== 1 || secret.nonce.length !== 12 || secret.tag.length !== 16) throw new Error("Stored provider key is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), secret.nonce);
  decipher.setAuthTag(secret.tag);
  return Buffer.concat([decipher.update(secret.ciphertext), decipher.final()]).toString("utf8");
}

export function encryptAiHelpMemory(plainText:string):EncryptedSecret {
  if (plainText.length>64_000) throw new Error("AI help memory is too large.");
  const nonce=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),nonce);
  const ciphertext=Buffer.concat([cipher.update(plainText,"utf8"),cipher.final()]);
  return {ciphertext,nonce,tag:cipher.getAuthTag(),version:1};
}

export function decryptAiHelpMemory(secret:EncryptedSecret):string {
  if (secret.version!==1 || secret.nonce.length!==12 || secret.tag.length!==16) throw new Error("Stored AI help memory is invalid.");
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),secret.nonce);
  decipher.setAuthTag(secret.tag);
  return Buffer.concat([decipher.update(secret.ciphertext),decipher.final()]).toString("utf8");
}
