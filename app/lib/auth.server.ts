import { queryOne, execute } from './db.server';
import type { User } from '~/types';

const SESSION_COOKIE = 'session';
const SESSION_DURATION_HOURS = 24 * 7;

// ─── Password ────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const saltBytes = Uint8Array.from(parts[1].match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const expectedHex = parts[2];
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 100_000 },
    keyMaterial,
    256
  );
  const gotHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return gotHex === expectedHex;
}

export function generateToken(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function createSession(db: CloudflareEnv['DB'], userId: number): Promise<string> {
  const id = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1000).toISOString();
  await execute(db, 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [id, userId, expiresAt]);
  return id;
}

export async function getSessionUser(db: CloudflareEnv['DB'], token: string): Promise<User | null> {
  if (!token) return null;
  return queryOne<User>(
    db,
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1`,
    [token]
  );
}

export async function deleteSession(db: CloudflareEnv['DB'], token: string): Promise<void> {
  await execute(db, 'DELETE FROM sessions WHERE id = ?', [token]);
}

export async function purgeExpiredSessions(db: CloudflareEnv['DB']): Promise<void> {
  await execute(db, 'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP', []);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export function setSessionCookie(token: string, request?: Request): string {
  const maxAge = SESSION_DURATION_HOURS * 3600;
  const secure = !request || new URL(request.url).protocol === 'https:';
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict`;
}

export function clearSessionCookie(request?: Request): string {
  const secure = !request || new URL(request.url).protocol === 'https:';
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict`;
}

export function getTokenFromRequest(request: Request): string {
  const cookie = request.headers.get('Cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return v ?? '';
  }
  return '';
}

// ─── Guards ──────────────────────────────────────────────────────────────────

export function requireUser(user: User | null): User {
  if (!user) throw new Response(null, { status: 302, headers: { Location: '/login' } });
  return user;
}

export function requireRole(user: User, ...roles: User['role'][]): User {
  if (!roles.includes(user.role)) throw new Response(null, { status: 403 });
  return user;
}
