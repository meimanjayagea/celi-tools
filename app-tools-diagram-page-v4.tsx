"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import mermaid from "mermaid";
import SaveButton from "@/components/save-button";
import { getSavedItem } from "@/app/saved/load";

const sample = `flowchart TD
  A[Login] --> B{Valid?}
  B -- Ya --> C[Dashboard]
  B -- Tidak --> A`;

function DiagramEditor() {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("load");

  const [code, setCode] = useState(sample);
  const [item, setItem] = useState<{ id: string; title: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadId) return;
    getSavedItem(loadId).then((d) => {
      if (d && d.type === "flowchart") {
        setCode(d.content);
        setItem({ id: d.id, title: d.title });
      }
    });
  }, [loadId]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "default" });
    const id = "diagram-" + Math.random().toString(36).slice(2);
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => {
        if (ref.current) ref.current.innerHTML = "<p class='text-red-600'>Sintaks belum valid</p>";
      });
  }, [code]);

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{item ? item.title : "Flow Diagram"}</h1>
        <SaveButton type="flowchart" content={code} itemId={item?.id} defaultTitle={item?.title} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <textarea
          className="h-96 rounded border p-2 font-mono text-sm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div ref={ref} className="overflow-auto rounded border bg-white p-4" />
      </div>
    </main>
  );
}

export default function DiagramPage() {
  return (
    <Suspense fallback={null}>
      <DiagramEditor />
    </Suspense>
  );
}
