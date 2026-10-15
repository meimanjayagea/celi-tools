"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseUseCase } from "@/lib/usecase";
import UseCaseDiagram from "@/components/usecase-diagram";
import SaveButton from "@/components/save-button";
import { getSavedItem } from "@/app/saved/load";

const sample = `# Sistem Login
actor Pengguna
actor Admin
usecase Login
usecase Kelola User
usecase Reset Password
Pengguna -- Login
Pengguna -- Reset Password
Admin -- Kelola User
Kelola User .> Login : include
Reset Password .> Login : extend`;

function UseCaseEditor() {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("load");

  const [src, setSrc] = useState(sample);
  const [item, setItem] = useState<{ id: string; title: string } | null>(null);
  const model = useMemo(() => parseUseCase(src), [src]);

  useEffect(() => {
    if (!loadId) return;
    getSavedItem(loadId).then((d) => {
      if (d && d.type === "usecase") {
        setSrc(d.content);
        setItem({ id: d.id, title: d.title });
      }
    });
  }, [loadId]);

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{item ? item.title : "Use Case Diagram"}</h1>
        <SaveButton type="usecase" content={src} itemId={item?.id} defaultTitle={item?.title} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <textarea
            className="h-96 w-full rounded border p-2 font-mono text-sm"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
          />
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer">Panduan sintaks</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-xs">{`actor Nama              deklarasi aktor
usecase Nama            deklarasi use case
Aktor -- UseCase        asosiasi
UseCase .> UseCase : include
UseCase .> UseCase : extend
# komentar`}</pre>
          </details>
          {model.errors.map((err) => (
            <p key={err} className="text-sm text-red-600">{err}</p>
          ))}
        </div>
        <UseCaseDiagram model={model} />
      </div>
    </main>
  );
}

export default function UseCasePage() {
  return (
    <Suspense fallback={null}>
      <UseCaseEditor />
    </Suspense>
  );
}
