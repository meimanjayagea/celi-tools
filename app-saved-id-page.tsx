import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SavedItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("saved_items")
    .select("id, type, title, content, updated_at")
    .eq("id", id)
    .single();

  if (!item) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-bold">{item.title}</h1>
        <p className="text-sm text-gray-500">{item.type}</p>
      </div>
      <pre className="overflow-auto whitespace-pre-wrap rounded border bg-white p-4 text-sm">
        {item.content}
      </pre>
    </main>
  );
}
