// lib/saved.ts (v0.5.0)
// Konstanta dan tipe dipisah dari file "use server".

export const SAVED_TYPES = ["flowchart", "usecase", "api-spec", "json"] as const;
export type SavedType = (typeof SAVED_TYPES)[number];

// Halaman tool tempat item tersimpan dibuka kembali (?load=<id>)
export const TOOL_PATH: Record<SavedType, string> = {
  flowchart: "/tools/diagram",
  usecase: "/tools/usecase",
  "api-spec": "/tools/api-docs",
  json: "/tools/json-beautify",
};

export const MAX_CONTENT_LENGTH = 200_000;
export const MAX_TITLE_LENGTH = 120;
