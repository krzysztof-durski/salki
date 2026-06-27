CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER  REFERENCES bookings(id) ON DELETE CASCADE,
  type       TEXT     NOT NULL
    CHECK(type IN ('booking_approved','booking_rejected','counter_proposed','change_approved','change_rejected')),
  is_read    INTEGER  NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_booking     ON notifications(booking_id);
