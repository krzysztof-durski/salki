-- Recurring booking series (admin-only): a booking_series row holds the
-- recurrence rule; each occurrence is materialized as a normal row in
-- bookings, linked back via series_id.
CREATE TABLE IF NOT EXISTS booking_series (
  id                       INTEGER  PRIMARY KEY AUTOINCREMENT,
  room_id                  INTEGER  NOT NULL REFERENCES rooms(id),
  created_by_admin_id      INTEGER  NOT NULL REFERENCES users(id),
  requester_id             INTEGER  NOT NULL REFERENCES users(id),
  title                    TEXT,
  start_time               TEXT     NOT NULL,
  end_time                 TEXT     NOT NULL,
  attendee_count           INTEGER,
  requester_note           TEXT,
  recurrence_type          TEXT     NOT NULL
    CHECK(recurrence_type IN ('weekly','monthly_fixed_day','monthly_nth_weekday')),
  weekday                  INTEGER  CHECK(weekday BETWEEN 1 AND 5),
  month_day                INTEGER  CHECK(month_day BETWEEN 1 AND 31),
  series_start_date        TEXT     NOT NULL,
  series_end_date          TEXT     NOT NULL,
  status                   TEXT     NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','cancelled','superseded')),
  supersedes_series_id     INTEGER  REFERENCES booking_series(id),
  superseded_by_series_id  INTEGER  REFERENCES booking_series(id),
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (recurrence_type = 'weekly'             AND weekday IS NOT NULL AND month_day IS NULL) OR
    (recurrence_type = 'monthly_fixed_day'   AND month_day IS NOT NULL AND weekday IS NULL) OR
    (recurrence_type = 'monthly_nth_weekday' AND weekday IS NOT NULL AND month_day IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_booking_series_status ON booking_series(status);

ALTER TABLE bookings ADD COLUMN series_id INTEGER REFERENCES booking_series(id);
ALTER TABLE bookings ADD COLUMN series_exception INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_series_id ON bookings(series_id);
