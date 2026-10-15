import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-10">
      <h1 className="text-3xl font-bold">Celi Tools</h1>
      <p>Bantu developer membangun aplikasi web, mobile, dan lainnya.</p>
      <ul className="list-disc pl-6">
        <li>Tools development: <Link href="/tools/json-beautify" className="underline">JSON Beautify</Link></li>
        <li>Tools dokumentasi: <Link href="/tools/api-docs" className="underline">API Contract</Link></li>
        <li>Tools desain: <Link href="/tools/diagram" className="underline">Flow Diagram</Link></li>
      </ul>
      <Link href="/login" className="inline-block rounded bg-black px-4 py-2 text-white">Masuk</Link>
    </main>
  );
}
