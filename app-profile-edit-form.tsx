"use client";
import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";

export default function EditProfileForm({ fullName, bio }: { fullName: string; bio: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, null);

  return (
    <form action={action} className="space-y-3 rounded border bg-white p-4">
      <label className="block text-sm">
        Nama
        <input name="full_name" defaultValue={fullName} maxLength={100}
          className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm">
        Bio
        <textarea name="bio" defaultValue={bio} rows={3} maxLength={500}
          className="mt-1 w-full rounded border p-2" />
      </label>
      <button disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Profil tersimpan.</p>}
    </form>
  );
}
