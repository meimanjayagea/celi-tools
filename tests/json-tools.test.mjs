import test from "node:test";
import assert from "node:assert/strict";
import {
  formatJson,
  fixJson,
  toXml,
  toCsv,
  cleanJson,
} from "../app/lib/json-tools.mjs";

test("formats valid JSON at the requested indentation", () => {
  assert.equal(formatJson('{"a":[1,2]}', 3), '{\n   "a": [\n      1,\n      2\n   ]\n}');
});

test("repair quotes bare keys and removes trailing commas", () => {
  assert.equal(fixJson("{name: 'Ada', items: [1, 2,],}"), '{\n  "name": "Ada",\n  "items": [\n    1,\n    2\n  ]\n}');
});

test("repair leaves comma-like text inside quoted strings untouched", () => {
  assert.equal(fixJson('{text: "value,}", label: \'x\'}'), '{\n  "text": "value,}",\n  "label": "x"\n}');
});

test("converts object and array values to XML", () => {
  assert.equal(toXml({ "profile-name": "Ada & Bob", tags: ["one", "two"] }), '<root>\n  <profile-name>Ada &amp; Bob</profile-name>\n  <tags>\n    <item>one</item>\n    <item>two</item>\n  </tags>\n</root>');
});

test("converts arrays of objects to CSV with escaped cells", () => {
  assert.equal(toCsv([{ name: "Ada, B", age: 36 }, { name: "Lin", age: 29 }]), 'name,age\n"Ada, B",36\nLin,29');
});

test("cleaner removes empty object fields and null array entries", () => {
  assert.deepEqual(cleanJson({ a: null, b: "", c: [1, null, "", { d: null }] }), { c: [1, {}] });
});
