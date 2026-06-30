-- Extend notification types to include zarzad booking events
PRAGMA foreign_keys = OFF;

CREATE TABLE notifications_new (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER  REFERENCES bookings(id) ON DELETE CASCADE,
  type       TEXT     NOT NULL
    CHECK(type IN (
      'booking_approved', 'booking_rejected', 'counter_proposed',
      'change_approved', 'change_rejected',
      'zarzad_created', 'zarzad_edited'
    )),
  is_read    INTEGER  NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO notifications_new SELECT * FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_booking     ON notifications(booking_id);

PRAGMA foreign_keys = ON;
