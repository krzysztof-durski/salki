import { execute } from './db.server';

export async function logAction(
  db: CloudflareEnv['DB'],
  opts: {
    userId: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
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
      opts.ipAddress ?? null,
    ]
  );
}
