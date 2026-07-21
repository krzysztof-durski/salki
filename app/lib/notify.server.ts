import { queryAll, queryOne, execute } from './db.server';
import { sendAdminNotificationEmails, sendRequesterNotificationEmail } from './email.server';
import type { AdminNotificationType, RequesterNotificationType } from '~/types';

export async function notifyAdmins(
  env: CloudflareEnv,
  bookingId: number,
  type: AdminNotificationType,
  details?: string | null
) {
  const admins = await queryAll<{ id: number; email: string; name: string; email_notifications_enabled: number }>(
    env.DB,
    "SELECT id, email, name, email_notifications_enabled FROM users WHERE role = 'admin' AND is_active = 1"
  );
  for (const admin of admins) {
    await execute(env.DB, "INSERT INTO notifications (user_id, booking_id, type, details) VALUES (?,?,?,?)", [admin.id, bookingId, type, details ?? null]);
  }

  const emailRecipients = admins.filter(a => a.email_notifications_enabled === 1);
  if (emailRecipients.length > 0) {
    try {
      await sendAdminNotificationEmails(env, bookingId, type, emailRecipients, details ?? null);
    } catch (err) {
      // sendAdminNotificationEmails already swallows its own errors; this is
      // defense in depth so a booking action never fails because of email.
      console.error('notifyAdmins: email dispatch failed', err);
    }
  }
}

// Notifies the requester who owns the booking about a status change to their
// own reservation (approved/rejected/countered/changed). Always emails —
// unlike notifyAdmins there's no per-user opt-out, since this is
// transactional information about the requester's own booking rather than a
// digest of other people's activity.
export async function notifyRequester(
  env: CloudflareEnv,
  bookingId: number,
  requesterId: number,
  type: RequesterNotificationType,
  details?: string | null
) {
  await execute(env.DB, "INSERT INTO notifications (user_id, booking_id, type, details) VALUES (?,?,?,?)", [requesterId, bookingId, type, details ?? null]);

  const requester = await queryOne<{ email: string; name: string }>(env.DB, "SELECT email, name FROM users WHERE id = ?", [requesterId]);
  if (!requester) return;

  try {
    await sendRequesterNotificationEmail(env, bookingId, type, { id: requesterId, email: requester.email, name: requester.name }, details ?? null);
  } catch (err) {
    // sendRequesterNotificationEmail already swallows its own errors; this is
    // defense in depth so a booking action never fails because of email.
    console.error('notifyRequester: email dispatch failed', err);
  }
}
