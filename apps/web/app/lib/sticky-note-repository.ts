import "server-only";
import { pool } from "./database";

export type StickyNote = {
  id: string; content: string; positionX: number; positionY: number; color: string;
  tags: string[]; reminderAt: string | null; createdAt: string; updatedAt: string;
};
type NoteRow = { id: string; content: string; position_x: number; position_y: number; color: string; tags: string[]; reminder_at: Date | null; created_at: Date; updated_at: Date };
function mapNote(row: NoteRow): StickyNote {
  return { id: row.id, content: row.content, positionX: row.position_x, positionY: row.position_y, color: row.color, tags: row.tags ?? [], reminderAt: row.reminder_at?.toISOString() ?? null, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}

/** Lists only the authenticated user's notes, in stable creation order. */
export async function listNotes(userId: string) {
  const result = await pool!.query<NoteRow>("SELECT * FROM celi_app.sticky_notes WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  return result.rows.map(mapNote);
}

/** Creates a private note; ownership is always supplied by the server session. */
export async function createNote(userId: string, note: { content: string; positionX: number; positionY: number; color: string; tags: string[]; reminderAt: string | null }) {
  const result = await pool!.query<NoteRow>(
    `INSERT INTO celi_app.sticky_notes (user_id, content, position_x, position_y, color, tags, reminder_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, note.content, note.positionX, note.positionY, note.color, note.tags, note.reminderAt],
  );
  return mapNote(result.rows[0]);
}

/** Updates only explicitly provided fields and scopes the write by owner. */
export async function updateNote(userId: string, id: string, note: Partial<{ content: string; positionX: number; positionY: number; color: string; tags: string[]; reminderAt: string | null }>) {
  const columns = { content: "content", positionX: "position_x", positionY: "position_y", color: "color", tags: "tags", reminderAt: "reminder_at" } as const;
  const sets: string[] = [];
  const values: unknown[] = [id, userId];
  for (const [key, column] of Object.entries(columns) as [keyof typeof columns, typeof columns[keyof typeof columns]][]) {
    if (key in note) { values.push(note[key]); sets.push(`${column} = $${values.length}`); }
  }
  if (!sets.length) return null;
  if ("reminderAt" in note) sets.push("reminder_notified_at = NULL");
  sets.push("updated_at = now()");
  const result = await pool!.query<NoteRow>(`UPDATE celi_app.sticky_notes SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`, values);
  return result.rows[0] ? mapNote(result.rows[0]) : null;
}

/** Deletes only a note belonging to the authenticated user. */
export async function deleteNote(userId: string, id: string) {
  const result = await pool!.query("DELETE FROM celi_app.sticky_notes WHERE id = $1 AND user_id = $2", [id, userId]);
  return result.rowCount === 1;
}

/** Claims due reminders atomically so tabs/processes do not notify twice. */
export async function claimDueReminders(userId: string) {
  const result = await pool!.query<{ id: string; content: string; reminder_at: Date }>(
    `WITH due AS (
       SELECT id FROM celi_app.sticky_notes
       WHERE user_id = $1 AND reminder_at <= now() AND reminder_notified_at IS NULL
       ORDER BY reminder_at LIMIT 20 FOR UPDATE SKIP LOCKED
     )
     UPDATE celi_app.sticky_notes AS notes SET reminder_notified_at = now(), updated_at = now()
     FROM due WHERE notes.id = due.id
     RETURNING notes.id, notes.content, notes.reminder_at`, [userId],
  );
  return result.rows.map(note => ({ id: note.id, content: note.content, reminderAt: note.reminder_at.toISOString() }));
}
