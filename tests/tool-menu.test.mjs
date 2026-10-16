import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_MENU_GROUPS } from "../app/lib/tool-menu.mjs";

test("JSON tools navigation includes every editor and visualization tool", () => {
  const ids = TOOL_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.id));
  for (const id of ["format", "validate", "fix", "clean", "tree", "graph", "json", "xml", "csv", "yaml", "upload", "download", "print", "indent", "auto-update"]) {
    assert.ok(ids.includes(id), `missing navigation action: ${id}`);
  }
});

test("navigation groups expose readable labels and non-empty submenus", () => {
  assert.ok(TOOL_MENU_GROUPS.length >= 4);
  for (const group of TOOL_MENU_GROUPS) {
    assert.ok(group.title.trim());
    assert.ok(group.items.length > 0);
    for (const item of group.items) assert.ok(item.label.trim());
  }
});
