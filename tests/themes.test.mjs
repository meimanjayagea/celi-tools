import test from "node:test";
import assert from "node:assert/strict";
import { THEMES } from "../app/lib/themes.mjs";

test("theme picker offers light, dark, and distinct color palettes", () => {
  const ids = THEMES.map((theme) => theme.id);
  assert.deepEqual(ids, ["light", "dark", "ocean", "forest"]);
  assert.equal(new Set(ids).size, ids.length);
  for (const theme of THEMES) {
    assert.ok(theme.label.trim());
    assert.ok(theme.description.trim());
  }
});
