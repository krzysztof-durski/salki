import type { D1Database } from '@cloudflare/workers-types';

export function getDB(env: CloudflareEnv): D1Database {
  return env.DB;
}

export async function queryAll<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results;
}

export async function queryOne<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return (await bound.first<T>()) ?? null;
}

export async function execute(db: D1Database, sql: string, params: unknown[] = []): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return bound.run();
}
