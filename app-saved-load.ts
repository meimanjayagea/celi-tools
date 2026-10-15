"use server";
import { createClient } from "@/lib/supabase/server";

// Mengambil satu item milik user yang sedang login.
export async function getSavedItem(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("saved_items")
    .select("id, type, title, content")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}
