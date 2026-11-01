export const NOTE_COLORS = ["yellow", "blue", "pink", "green", "purple"];
export const MAX_NOTE_TEXT_LENGTH = 5000;
export const MAX_TAGS = 10;
const NOTE_FIELDS = new Set(["content", "positionX", "positionY", "color", "tags", "reminderAt"]);

export function validateNoteInput(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Isi catatan tidak valid." };
  const keys = Object.keys(input);
  if (keys.some(key => !NOTE_FIELDS.has(key)) || (!partial && keys.length === 0)) return { ok: false, error: "Properti catatan tidak dikenal." };
  const value = {};
  if (!partial || "content" in input) {
    if (typeof input.content !== "string" || input.content.length > MAX_NOTE_TEXT_LENGTH) return { ok: false, error: "Teks catatan maksimal 5.000 karakter." };
    value.content = input.content;
  }
  for (const key of ["positionX", "positionY"]) {
    if (!partial || key in input) {
      if (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > 10000) return { ok: false, error: "Posisi catatan tidak valid." };
      value[key] = input[key];
    }
  }
  if (!partial || "color" in input) {
    if (!NOTE_COLORS.includes(input.color)) return { ok: false, error: "Warna catatan tidak valid." };
    value.color = input.color;
  }
  if (!partial || "tags" in input) {
    if (!Array.isArray(input.tags) || input.tags.length > MAX_TAGS || input.tags.some(tag => typeof tag !== "string" || tag.length > 24 || /[\u0000-\u001f\u007f]/.test(tag))) return { ok: false, error: "Tag tidak valid (maksimal 10 tag, 24 karakter per tag)." };
    const tags = input.tags.map(tag => tag.trim()).filter(Boolean);
    if (new Set(tags.map(tag => tag.toLocaleLowerCase("id-ID"))).size !== tags.length) return { ok: false, error: "Tag tidak boleh duplikat." };
    value.tags = tags;
  }
  if (!partial || "reminderAt" in input) {
    if (input.reminderAt !== null && (typeof input.reminderAt !== "string" || !Number.isFinite(Date.parse(input.reminderAt)))) return { ok: false, error: "Waktu pengingat tidak valid." };
    value.reminderAt = input.reminderAt === null ? null : new Date(input.reminderAt).toISOString();
  }
  return { ok: true, value };
}

export function isNoteId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
