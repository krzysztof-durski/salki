-- Role values: super_admin | admin | zarzad | dyrektor | pracownik

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER  PRIMARY KEY AUTOINCREMENT,
  email                TEXT     UNIQUE NOT NULL,
  name                 TEXT     NOT NULL,
  password_hash        TEXT     NOT NULL,
  role                 TEXT     NOT NULL
    CHECK(role IN ('super_admin','admin','zarzad','dyrektor','pracownik')),
  must_change_password INTEGER  NOT NULL DEFAULT 1,
  is_active            INTEGER  NOT NULL DEFAULT 1,
  on_duty              INTEGER  NOT NULL DEFAULT 0,
  preferred_room_id    INTEGER  REFERENCES rooms(id) ON DELETE SET NULL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT     PRIMARY KEY,
  user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  name        TEXT     NOT NULL,
  size_label  TEXT,
  category    TEXT     NOT NULL CHECK(category IN ('general','board')),
  is_active   INTEGER  NOT NULL DEFAULT 1,
  sort_order  INTEGER  DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
  room_id             INTEGER  NOT NULL REFERENCES rooms(id),
  requester_id        INTEGER  NOT NULL REFERENCES users(id),
  created_by_admin_id INTEGER  REFERENCES users(id),
  title               TEXT,
  date                TEXT     NOT NULL,
  start_time          TEXT     NOT NULL,
  end_time            TEXT     NOT NULL,
  attendee_count      INTEGER,
  attendee_emails     TEXT,
  status              TEXT     NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected','counter_proposed')),
  requester_note      TEXT,
  admin_note          TEXT,
  counter_date        TEXT,
  counter_start_time  TEXT,
  counter_end_time    TEXT,
  version             INTEGER  NOT NULL DEFAULT 1,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_change_requests (
  id                 INTEGER  PRIMARY KEY AUTOINCREMENT,
  booking_id         INTEGER  NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requester_id       INTEGER  NOT NULL REFERENCES users(id),
  new_date           TEXT,
  new_start_time     TEXT,
  new_end_time       TEXT,
  new_attendee_count INTEGER,
  new_attendee_emails TEXT,
  new_title          TEXT,
  requester_note     TEXT,
  status             TEXT     NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')),
  admin_note         TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER  REFERENCES users(id),
  action      TEXT     NOT NULL,
  entity_type TEXT     NOT NULL,
  entity_id   INTEGER,
  details     TEXT,
  ip_address  TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_requester ON bookings(requester_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status    ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_logs(created_at);
