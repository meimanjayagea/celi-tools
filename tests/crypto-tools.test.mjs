import test from "node:test";
import assert from "node:assert/strict";
import { hashText, base64Encode, base64Decode, toHex, fromHex, toBinary, fromBinary, aesEncrypt, aesDecrypt } from "../app/lib/crypto-tools.mjs";

test("hashes match published abc test vectors", async () => {
  assert.equal(await hashText("MD5", "abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(await hashText("SHA-256", "abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("text encodings preserve UTF-8 including non-ASCII and newlines", () => {
  const text = "Celi 工具 🌊\nbaris kedua";
  assert.equal(base64Decode(base64Encode(text)), text);
  assert.equal(fromHex(toHex(text)), text);
  assert.equal(fromBinary(toBinary(text)), text);
});

test("AES round-trips text and rejects a different password", async () => {
  const encrypted = await aesEncrypt("Pesan uji Celi", "test-password");
  assert.equal(await aesDecrypt(encrypted, "test-password"), "Pesan uji Celi");
  await assert.rejects(() => aesDecrypt(encrypted, "wrong-password"), /kata sandi salah/);
});
