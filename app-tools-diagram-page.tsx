"use client";
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

const sample = `flowchart TD
  A[Login] --> B{Valid?}
  B -- Ya --> C[Dashboard]
  B -- Tidak --> A`;

export default function DiagramPage() {
  const [code, setCode] = useState(sample);
  const ref = useRef<HTMLDivElement>(null);

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
    <main className="grid gap-4 p-6 md:grid-cols-2">
      <textarea
        className="h-96 rounded border p-2 font-mono text-sm"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <div ref={ref} className="overflow-auto rounded border bg-white p-4" />
    </main>
  );
}
