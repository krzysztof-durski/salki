import { queryAll, execute } from './db.server';
import { sendAdminNotificationEmails } from './email.server';
import type { AdminNotificationType } from '~/types';

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
