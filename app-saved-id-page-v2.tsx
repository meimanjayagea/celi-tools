import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TOOL_PATH, type SavedType } from "@/lib/saved";

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
    .select("id, type, title, content")
    .eq("id", id)
    .single();

  if (!item) notFound();

  const toolPath = TOOL_PATH[item.type as SavedType];

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="text-sm text-gray-500">{item.type}</p>
        </div>
        {toolPath && (
          <Link href={`${toolPath}?load=${item.id}`}
            className="rounded bg-black px-3 py-1 text-sm text-white">
            Buka di tool
          </Link>
        )}
      </div>
      <pre className="overflow-auto whitespace-pre-wrap rounded border bg-white p-4 text-sm">
        {item.content}
      </pre>
    </main>
  );
}
