-- Rate limiting for login (per email+IP) and observer shared-password (per IP)
-- attempts. Append-only: one row per failed attempt; counted within a rolling
-- window per bucket_key. This avoids read-modify-write races on a stateless
-- edge runtime. Old rows are purged by the existing retention job rather than
-- a separate cron (see app/lib/retention.server.ts).
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  bucket_key TEXT     NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_created ON rate_limit_attempts(bucket_key, created_at);
