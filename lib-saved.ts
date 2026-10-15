// lib/saved.ts
// Konstanta dan tipe dipisah dari file "use server" karena file tersebut
// hanya boleh mengekspor fungsi async.

export const SAVED_TYPES = ["diagram", "api-spec", "json"] as const;
export type SavedType = (typeof SAVED_TYPES)[number];

export const MAX_CONTENT_LENGTH = 200_000;
export const MAX_TITLE_LENGTH = 120;
