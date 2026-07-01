import { execute } from './db.server';

// Bookings older than 6 months (by event date) are purged; booking_change_requests
// cascade-delete automatically via their ON DELETE CASCADE foreign key.
const BOOKING_RETENTION = "-6 months";
// Audit logs older than 12 months are purged.
const AUDIT_LOG_RETENTION = "-12 months";

export async function runRetentionCleanup(db: CloudflareEnv['DB']): Promise<void> {
  await execute(
    db,
    `DELETE FROM bookings WHERE date < date('now', ?)`,
    [BOOKING_RETENTION]
  );
  await execute(
    db,
    `DELETE FROM audit_logs WHERE created_at < datetime('now', ?)`,
    [AUDIT_LOG_RETENTION]
  );
}
