import { auth } from "../../../auth";
import { databaseReady } from "../../lib/database";
import { createNote, listNotes } from "../../lib/sticky-note-repository";
import { validateNoteInput } from "../../lib/sticky-note-validation.mjs";

type NewNoteInput = { content: string; positionX: number; positionY: number; color: string; tags: string[]; reminderAt: string | null };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
async function currentUser() {
  const session = await auth();
  return session?.user?.id || null;
}
async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 16_384) throw new Error("too_large");
  const text = await request.text();
  if (text.length > 16_384) throw new Error("too_large");
  return JSON.parse(text);
}

export async function GET() {
  if (!databaseReady) return json({ error: "Penyimpanan catatan belum tersedia." }, 503);
  try {
    const userId = await currentUser();
    if (!userId) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
    return json({ notes: await listNotes(userId) });
  } catch {
    return json({ error: "Catatan belum dapat dimuat." }, 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  if (!databaseReady) return json({ error: "Penyimpanan catatan belum tersedia." }, 503);
  try {
    const userId = await currentUser();
    if (!userId) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const validation = validateNoteInput(await readBody(request));
    if (!validation.ok || !validation.value) return json({ error: validation.error }, 422);
    return json({ note: await createNote(userId, validation.value as NewNoteInput) }, 201);
  } catch (error) {
    return error instanceof Error && error.message === "too_large"
      ? json({ error: "Permintaan terlalu besar." }, 413)
      : json({ error: "Catatan belum dapat disimpan." }, 503);
  }
}
