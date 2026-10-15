// lib/usecase.ts
// Parser sederhana untuk DSL use case diagram.
//
// Sintaks:
//   actor Pengguna
//   usecase Login
//   Pengguna -- Login                 (asosiasi)
//   Kelola User .> Login : include    (include)
//   Reset Password .> Login : extend  (extend)
//   # komentar

export type UCKind = "actor" | "usecase";
export type UCNode = { id: string; kind: UCKind };
export type UCEdge = { from: string; to: string; kind: "assoc" | "include" | "extend" };
export type UCModel = { nodes: UCNode[]; edges: UCEdge[]; errors: string[] };

const DECL = /^(actor|usecase)\s+(.+)$/i;
const EDGE = /^(.+?)\s+(--|\.>)\s+(.+?)(?:\s*:\s*(include|extend))?$/i;

export function parseUseCase(src: string): UCModel {
  const nodes = new Map<string, UCNode>();
  const edges: UCEdge[] = [];
  const errors: string[] = [];

  const lines = src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  lines.forEach((line, i) => {
    const where = `Baris ${i + 1}`;

    const decl = line.match(DECL);
    if (decl) {
      const kind = decl[1].toLowerCase() as UCKind;
      const id = decl[2].trim();
      const existing = nodes.get(id);
      if (existing && existing.kind !== kind) {
        errors.push(`${where}: "${id}" sudah dideklarasikan sebagai ${existing.kind}`);
      } else {
        nodes.set(id, { id, kind });
      }
      return;
    }

    const edge = line.match(EDGE);
    if (!edge) {
      errors.push(`${where}: format tidak dikenali`);
      return;
    }

    const from = edge[1].trim();
    const to = edge[3].trim();
    for (const id of [from, to]) {
      if (!nodes.has(id)) errors.push(`${where}: "${id}" belum dideklarasikan`);
    }

    let kind: UCEdge["kind"] = "assoc";
    if (edge[2] === ".>") {
      kind = edge[4]?.toLowerCase() === "extend" ? "extend" : "include";
    }
    edges.push({ from, to, kind });
  });

  return { nodes: [...nodes.values()], edges, errors };
}
