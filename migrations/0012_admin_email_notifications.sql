-- Per-admin email notification preference for booking-request/change alerts.
-- Only meaningful for role='admin' (notifyAdmins() already restricts email
-- recipients to role='admin', excluding super_admin/zarzad/pracownik).
--
-- Snooze semantics: an admin can turn this off from /ustawienia, but it is
-- only a "mute until next login" — login.tsx resets it back to 1 on every
-- successful authentication, so it can never be permanently disabled.
ALTER TABLE users ADD COLUMN email_notifications_enabled INTEGER NOT NULL DEFAULT 1;
