"use client";
import { useMemo, useState } from "react";
import { parseUseCase } from "@/lib/usecase";
import UseCaseDiagram from "@/components/usecase-diagram";
import SaveButton from "@/components/save-button";

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

export default function UseCasePage() {
  const [src, setSrc] = useState(sample);
  const model = useMemo(() => parseUseCase(src), [src]);

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Use Case Diagram</h1>
        <SaveButton type="diagram" content={src} />
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
