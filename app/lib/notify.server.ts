import type { D1Database } from '@cloudflare/workers-types';
import { queryAll, execute } from './db.server';

export async function notifyAdmins(
  db: D1Database,
  bookingId: number,
  type: 'zarzad_created' | 'zarzad_edited' | 'booking_requested' | 'change_requested' | 'note_changed',
  details?: string | null
) {
  const admins = await queryAll<{ id: number }>(
    db,
    "SELECT id FROM users WHERE role = 'admin' AND is_active = 1"
  );
  for (const admin of admins) {
    await execute(db, "INSERT INTO notifications (user_id, booking_id, type, details) VALUES (?,?,?,?)", [admin.id, bookingId, type, details ?? null]);
  }
}
