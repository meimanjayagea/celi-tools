"use client";
import { useState } from "react";

export default function JsonBeautifyPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

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
    <main className="grid gap-4 p-6 md:grid-cols-2">
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
    </main>
  );
}
