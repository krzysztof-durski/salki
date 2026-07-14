import { execute } from './db.server';
import { logAction } from './audit.server';

// Bookings older than 6 months (by event date) are purged; booking_change_requests
// cascade-delete automatically via their ON DELETE CASCADE foreign key.
const BOOKING_RETENTION = "-6 months";
// Audit logs older than 12 months are purged.
const AUDIT_LOG_RETENTION = "-12 months";
// Rate-limit attempt rows are only ever needed within the current window.
const RATE_LIMIT_RETENTION = "-1 day";

export async function runRetentionCleanup(db: CloudflareEnv['DB']): Promise<void> {
  const bookingsResult = await execute(
    db,
    `DELETE FROM bookings WHERE date < date('now', ?)`,
    [BOOKING_RETENTION]
  );
  const auditLogsResult = await execute(
    db,
    `DELETE FROM audit_logs WHERE created_at < datetime('now', ?)`,
    [AUDIT_LOG_RETENTION]
  );
  const rateLimitResult = await execute(
    db,
    `DELETE FROM rate_limit_attempts WHERE created_at < datetime('now', ?)`,
    [RATE_LIMIT_RETENTION]
  );

  await logAction(db, {
    userId: null,
    action: 'retention.cleanup',
    entityType: 'system',
    details: {
      bookingsDeleted: bookingsResult.meta.changes ?? 0,
      auditLogsDeleted: auditLogsResult.meta.changes ?? 0,
      rateLimitAttemptsDeleted: rateLimitResult.meta.changes ?? 0,
    },
  });
}
