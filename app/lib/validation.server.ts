const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateFormat(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeFormat(s: string | null | undefined): s is string {
  return !!s && TIME_RE.test(s);
}

export function isPastDate(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export type AttendeeCountResult = { ok: true; value: number | null } | { ok: false; error: string };

export function parseAttendeeCount(raw: FormDataEntryValue | null): AttendeeCountResult {
  if (raw === null || raw === '') return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 500) {
    return { ok: false, error: "Liczba uczestników musi być liczbą całkowitą od 0 do 500." };
  }
  return { ok: true, value: n };
}
