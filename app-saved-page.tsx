import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteItem } from "./actions";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items, error } = await supabase
    .from("saved_items")
    .select("id, type, title, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Tersimpan</h1>
      {error && <p className="text-red-600">{error.message}</p>}
      {items?.length === 0 && <p className="text-gray-600">Belum ada item tersimpan.</p>}
      <ul className="space-y-2">
        {items?.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded border bg-white p-3">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-gray-500">
                {item.type} · {new Date(item.updated_at).toLocaleString("id-ID")}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link href={`/saved/${item.id}`} className="underline">Buka</Link>
              <form action={deleteItem}>
                <input type="hidden" name="id" value={item.id} />
                <button className="text-red-600">Hapus</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
