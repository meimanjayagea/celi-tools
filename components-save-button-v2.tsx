"use client";
import { useActionState, useState } from "react";
import { saveItem, type SaveState } from "@/app/saved/actions";
import type { SavedType } from "@/lib/saved";

type Props = {
  type: SavedType;
  content: string;
  itemId?: string | null;   // jika ada, tombol menjadi "Perbarui"
  defaultTitle?: string;
};

export default function SaveButton({ type, content, itemId = null, defaultTitle = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SaveState, FormData>(saveItem, null);

  const savedId = state?.id ?? itemId;
  const label = savedId ? "Perbarui" : "Simpan";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded border px-3 py-1 text-sm">
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="content" value={content} />
      {savedId && <input type="hidden" name="id" value={savedId} />}
      <input name="title" required maxLength={120} defaultValue={defaultTitle}
        placeholder="Judul" className="rounded border p-1 text-sm" />
      <button disabled={pending}
        className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50">
        {pending ? "Menyimpan..." : label}
      </button>
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.id && !pending && <span className="text-sm text-green-600">Tersimpan</span>}
    </form>
  );
}
