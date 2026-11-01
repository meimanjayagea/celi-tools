import { auth } from "../../../../auth";
import { databaseReady } from "../../../lib/database";
import { deleteNote, updateNote } from "../../../lib/sticky-note-repository";
import { isNoteId, validateNoteInput } from "../../../lib/sticky-note-validation.mjs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  if (!databaseReady) return json({ error: "Penyimpanan catatan belum tersedia." }, 503);
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const { id } = await context.params;
    if (!isNoteId(id)) return json({ error: "ID catatan tidak valid." }, 400);
    const length = Number(request.headers.get("content-length") || "0");
    const body = await request.text();
    if (length > 16_384 || body.length > 16_384) return json({ error: "Permintaan terlalu besar." }, 413);
    const validation = validateNoteInput(JSON.parse(body), { partial: true });
    if (!validation.ok || !validation.value) return json({ error: validation.error }, 422);
    const note = await updateNote(userId, id, validation.value);
    return note ? json({ note }) : json({ error: "Catatan tidak ditemukan." }, 404);
  } catch {
    return json({ error: "Catatan belum dapat diperbarui." }, 503);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  if (!databaseReady) return json({ error: "Penyimpanan catatan belum tersedia." }, 503);
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const { id } = await context.params;
    if (!isNoteId(id)) return json({ error: "ID catatan tidak valid." }, 400);
    return await deleteNote(userId, id) ? json({ deleted: true }) : json({ error: "Catatan tidak ditemukan." }, 404);
  } catch {
    return json({ error: "Catatan belum dapat dihapus." }, 503);
  }
}
