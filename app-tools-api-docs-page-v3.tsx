"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parse } from "yaml";
import SaveButton from "@/components/save-button";
import { getSavedItem } from "@/app/saved/load";

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

function ApiDocsEditor() {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("load");

  const [spec, setSpec] = useState(sample);
  const [item, setItem] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!loadId) return;
    getSavedItem(loadId).then((d) => {
      if (d && d.type === "api-spec") {
        setSpec(d.content);
        setItem({ id: d.id, title: d.title });
      }
    });
  }, [loadId]);

  const { doc, error } = useMemo(() => {
    try {
      return { doc: parse(spec), error: "" };
    } catch (e) {
      return { doc: null, error: (e as Error).message };
    }
  }, [spec]);

  const paths: [string, any][] = doc?.paths ? Object.entries(doc.paths) : [];

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{item ? item.title : "API Contract"}</h1>
        <SaveButton type="api-spec" content={spec} itemId={item?.id} defaultTitle={item?.title} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          {paths.map(([path, pathItem]) =>
            METHODS.filter((m) => pathItem?.[m]).map((m) => {
              const op = pathItem[m];
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
      </div>
    </main>
  );
}

export default function ApiDocsPage() {
  return (
    <Suspense fallback={null}>
      <ApiDocsEditor />
    </Suspense>
  );
}
