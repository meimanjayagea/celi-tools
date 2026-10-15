"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SaveButton from "@/components/save-button";
import { getSavedItem } from "@/app/saved/load";

function JsonEditor() {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("load");

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [item, setItem] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!loadId) return;
    getSavedItem(loadId).then((d) => {
      if (d && d.type === "json") {
        setInput(d.content);
        setOutput(d.content);
        setItem({ id: d.id, title: d.title });
      }
    });
  }, [loadId]);

  const format = (indent: number) => {
    try {
      setOutput(JSON.stringify(JSON.parse(input), null, indent));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setOutput("");
    }
  };

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{item ? item.title : "JSON Beautify"}</h1>
        <SaveButton type="json" content={output} itemId={item?.id} defaultTitle={item?.title} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <textarea
          className="h-96 rounded border p-2 font-mono text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tempel JSON di sini"
        />
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={() => format(2)} className="rounded border px-3 py-1">Beautify</button>
            <button onClick={() => format(0)} className="rounded border px-3 py-1">Minify</button>
            <button onClick={() => navigator.clipboard.writeText(output)} className="rounded border px-3 py-1">Salin</button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <pre className="h-96 overflow-auto rounded border bg-white p-2 text-sm">{output}</pre>
        </div>
      </div>
    </main>
  );
}

export default function JsonBeautifyPage() {
  return (
    <Suspense fallback={null}>
      <JsonEditor />
    </Suspense>
  );
}
