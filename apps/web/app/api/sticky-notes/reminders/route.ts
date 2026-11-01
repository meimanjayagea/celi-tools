import { auth } from "../../../../auth";
import { databaseReady } from "../../../lib/database";
import { claimDueReminders } from "../../../lib/sticky-note-repository";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Permintaan tidak diizinkan." }, { status: 403, headers });
  if (!databaseReady) return Response.json({ error: "Penyimpanan catatan belum tersedia." }, { status: 503, headers });
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401, headers });
    return Response.json({ reminders: await claimDueReminders(userId) }, { headers });
  } catch {
    return Response.json({ error: "Pengingat belum dapat diperiksa." }, { status: 503, headers });
  }
}
