import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tools = [
    { href: "/tools/json-beautify", title: "JSON Beautify", desc: "Format dan minify JSON" },
    { href: "/tools/api-docs", title: "API Contract", desc: "Susun dokumentasi API" },
    { href: "/tools/diagram", title: "Flow Diagram", desc: "Buat diagram dengan Mermaid" },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Halo, {user.user_metadata.full_name ?? user.email}</h1>
        <LogoutButton />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {tools.map((t) => (
          <a key={t.href} href={t.href} className="rounded border bg-white p-4 hover:shadow">
            <h2 className="font-semibold">{t.title}</h2>
            <p className="text-sm text-gray-600">{t.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
