-- Shared/kiosk password for anonymous read-only calendar access, so it's stored
-- in plain text (Super Admin can view it, not just reset it) rather than hashed.
CREATE TABLE IF NOT EXISTS observer_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

INSERT INTO observer_settings (id, is_enabled) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS observer_sessions (
  id TEXT PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
