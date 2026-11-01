import test from "node:test";
import assert from "node:assert/strict";
import { isNoteId, validateNoteInput } from "../apps/web/app/lib/sticky-note-validation.mjs";

const validNote = { content: "Rencana kerja", positionX: 20, positionY: 30, color: "yellow", tags: ["Kerja"], reminderAt: null };

test("validates and normalizes note fields", () => {
  const result = validateNoteInput({ ...validNote, tags: [" Kerja ", "Pribadi"] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.tags, ["Kerja", "Pribadi"]);
});

test("rejects ownership fields, invalid positions, colors and oversized notes", () => {
  for (const note of [
    { ...validNote, userId: "another-user" },
    { ...validNote, positionX: -1 },
    { ...validNote, color: "url(javascript:alert(1))" },
    { ...validNote, content: "x".repeat(5001) },
    { ...validNote, tags: ["Sama", " sama "] },
  ]) assert.equal(validateNoteInput(note).ok, false);
});

test("partial updates validate only included fields and still reject unknown keys", () => {
  assert.deepEqual(validateNoteInput({ content: "baru" }, { partial: true }), { ok: true, value: { content: "baru" } });
  assert.equal(validateNoteInput({ user_id: "user" }, { partial: true }).ok, false);
});

test("accepts UUID note IDs only", () => {
  assert.equal(isNoteId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isNoteId("../other-user"), false);
});
