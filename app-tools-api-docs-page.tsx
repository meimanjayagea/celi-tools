"use client";
import { useState } from "react";

const sample = `openapi: 3.0.0
info:
  title: Contoh API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Ambil daftar user
      responses:
        "200":
          description: OK`;

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(sample);

  return (
    <main className="grid gap-4 p-6 md:grid-cols-2">
      <textarea
        className="h-96 rounded border p-2 font-mono text-sm"
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
      />
      <pre className="h-96 overflow-auto whitespace-pre-wrap rounded border bg-white p-4 text-sm">
        {spec}
      </pre>
    </main>
  );
}
