import { execute } from './db.server';

export async function logAction(
  db: CloudflareEnv['DB'],
  opts: {
    userId: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: Record<string, unknown>;
    // The incoming request, when one exists (system/cron actions have none)
    // — the IP is read from it here so callers can't forget to pass it.
    request?: Request | null;
  }
) {
  await execute(
    db,
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      opts.userId,
      opts.action,
      opts.entityType,
      opts.entityId ?? null,
      opts.details ? JSON.stringify(opts.details) : null,
      opts.request?.headers.get('CF-Connecting-IP') ?? null,
    ]
  );
}
