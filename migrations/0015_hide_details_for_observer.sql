ALTER TABLE bookings ADD COLUMN hide_details_for_observer INTEGER NOT NULL DEFAULT 0;
ALTER TABLE booking_series ADD COLUMN hide_details_for_observer INTEGER NOT NULL DEFAULT 0;
