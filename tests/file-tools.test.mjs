import test from "node:test";
import assert from "node:assert/strict";
import { CONVERTER_GROUPS, COMPRESS_METHODS, conversionTargets, validateSelection, FILE_LIMITS } from "../packages/file-tools/index.mjs";

test("batch conversions expose only formats shared by every source", () => {
  assert.deepEqual(conversionTargets(["image.png", "document.docx"]), ["pdf"]);
  assert.ok(conversionTargets(["movie.mp4"]).includes("mp3"));
  assert.deepEqual(conversionTargets(["unknown.exe"]), []);
  assert.deepEqual(conversionTargets(["document.docx"], { office: false }), []);
});
test("all extensions have one unambiguous conversion group", () => {
  const extensions = CONVERTER_GROUPS.flatMap(group => group.inputs);
  assert.equal(new Set(extensions).size, extensions.length);
  assert.equal(new Set(COMPRESS_METHODS.map(method => method.id)).size, COMPRESS_METHODS.length);
});
test("archives accept arbitrary bytes but specialized compression validates file types", () => {
  assert.equal(validateSelection([{name:"program.exe",size:12}], "compress", "zip"), "");
  assert.match(validateSelection([{name:"file.txt",size:12}], "compress", "image"), /Jenis file/);
  assert.match(validateSelection([{name:"a.txt",size:12},{name:"b.txt",size:12}], "compress", "gzip"), /satu file/);
});
test("upload count, total bytes and disabled engines are checked before processing", () => {
  assert.match(validateSelection([], "compress", "zip"), /Pilih file/);
  assert.match(validateSelection(Array.from({length:11},()=>({name:"a.txt",size:1})), "compress", "zip"), /10 file/);
  assert.match(validateSelection([{name:"a.png",size:FILE_LIMITS.maxBytes+1}], "convert", "jpg"), /100 MB/);
  assert.match(validateSelection([{name:"a.mp4",size:12}], "compress", "video", { media:false }), /belum tersedia/);
});
