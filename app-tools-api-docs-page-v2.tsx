"use client";
import { useMemo, useState } from "react";
import { parse } from "yaml";

const sample = `openapi: 3.0.0
info:
  title: Contoh API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Ambil daftar user
      parameters:
        - name: limit
          in: query
          required: false
      responses:
        "200":
          description: Daftar user
    post:
      summary: Buat user baru
      description: Membuat user dengan data yang dikirim di body.
      responses:
        "201":
          description: User berhasil dibuat
        "400":
          description: Data tidak valid`;

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

const methodColor: Record<string, string> = {
  get: "bg-blue-100 text-blue-800",
  post: "bg-green-100 text-green-800",
  put: "bg-amber-100 text-amber-800",
  patch: "bg-purple-100 text-purple-800",
  delete: "bg-red-100 text-red-800",
};

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(sample);

  const { doc, error } = useMemo(() => {
    try {
      return { doc: parse(spec), error: "" };
    } catch (e) {
      return { doc: null, error: (e as Error).message };
    }
  }, [spec]);

  const paths: [string, any][] = doc?.paths ? Object.entries(doc.paths) : [];

  return (
    <main className="grid gap-4 p-6 md:grid-cols-2">
      <textarea
        className="h-[80vh] rounded border p-2 font-mono text-sm"
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        placeholder="Tempel OpenAPI (YAML) di sini"
      />
      <div className="max-h-[80vh] space-y-3 overflow-auto">
        {error && <p className="text-sm text-red-600">YAML tidak valid: {error}</p>}
        {doc?.info && (
          <div>
            <h2 className="text-xl font-bold">{doc.info.title}</h2>
            <p className="text-sm text-gray-600">Versi {doc.info.version}</p>
          </div>
        )}
        {paths.map(([path, item]) =>
          METHODS.filter((m) => item?.[m]).map((m) => {
            const op = item[m];
            return (
              <div key={m + path} className="rounded border bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${methodColor[m]}`}>
                    {m}
                  </span>
                  <code className="text-sm">{path}</code>
                </div>
                {op.summary && <p className="mt-1 font-medium">{op.summary}</p>}
                {op.description && <p className="text-sm text-gray-600">{op.description}</p>}

                {(op.parameters?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500">PARAMETER</p>
                    <ul className="text-sm">
                      {op.parameters.map((p: any) => (
                        <li key={`${p.in}-${p.name}`}>
                          <code>{p.name}</code> ({p.in}){p.required ? " · wajib" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {op.responses && (
                  <div className="mt-2 text-sm">
                    <p className="text-xs font-semibold text-gray-500">RESPONSE</p>
                    {Object.entries(op.responses).map(([code, r]: [string, any]) => (
                      <p key={code}>
                        <code>{code}</code> {r?.description}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
