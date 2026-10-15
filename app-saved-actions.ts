"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  SAVED_TYPES,
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  type SavedType,
} from "@/lib/saved";

export type SaveState = { error?: string; id?: string } | null;

export async function saveItem(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir, silakan masuk kembali." };

  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE_LENGTH);
  const content = String(formData.get("content") ?? "");
  const id = String(formData.get("id") ?? "") || null;

  if (!SAVED_TYPES.includes(type as SavedType)) return { error: "Tipe tidak dikenal." };
  if (!title) return { error: "Judul wajib diisi." };
  if (content.length > MAX_CONTENT_LENGTH) return { error: "Konten terlalu besar (maks 200 KB)." };

  if (id) {
    const { error } = await supabase
      .from("saved_items")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/saved");
    return { id };
  }

  const { data, error } = await supabase
    .from("saved_items")
    .insert({ user_id: user.id, type, title, content })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/saved");
  return { id: data.id };
}

export async function deleteItem(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id"));
  await supabase.from("saved_items").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/saved");
}
