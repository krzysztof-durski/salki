import { queryOne, execute } from './db.server';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

export async function checkRateLimit(db: CloudflareEnv['DB'], bucketKey: string): Promise<{ allowed: boolean }> {
  const row = await queryOne<{ n: number }>(
    db,
    `SELECT COUNT(*) as n FROM rate_limit_attempts WHERE bucket_key = ? AND created_at > datetime('now', ?)`,
    [bucketKey, `-${WINDOW_MINUTES} minutes`]
  );
  return { allowed: (row?.n ?? 0) < MAX_ATTEMPTS };
}

export async function recordFailedAttempt(db: CloudflareEnv['DB'], bucketKey: string): Promise<void> {
  await execute(db, `INSERT INTO rate_limit_attempts (bucket_key) VALUES (?)`, [bucketKey]);
}

export async function clearAttempts(db: CloudflareEnv['DB'], bucketKey: string): Promise<void> {
  await execute(db, `DELETE FROM rate_limit_attempts WHERE bucket_key = ?`, [bucketKey]);
}
