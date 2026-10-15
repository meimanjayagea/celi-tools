"use client";
import { useActionState, useState } from "react";
import { saveItem, type SaveState } from "@/app/saved/actions";
import type { SavedType } from "@/lib/saved";

export default function SaveButton({ type, content }: { type: SavedType; content: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SaveState, FormData>(saveItem, null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded border px-3 py-1 text-sm">
        Simpan
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="content" value={content} />
      <input name="title" required maxLength={120} placeholder="Judul"
        className="rounded border p-1 text-sm" />
      <button disabled={pending}
        className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.id && <span className="text-sm text-green-600">Tersimpan</span>}
    </form>
  );
}
