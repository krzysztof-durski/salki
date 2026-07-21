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

function nowInWarsaw(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

// Whole days since some fixed reference point, purely from the Y/M/D digits
// (no timezone conversion) — used only to diff two Warsaw wall-clock
// date/time pairs, so DST offsets never enter the calculation.
function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function minutesSinceEpochDay(dateStr: string, timeStr: string): number {
  const [h, min] = timeStr.split(':').map(Number);
  return dayNumber(dateStr) * 1440 + h * 60 + min;
}

// Rejects a date/time slot only once it's more than ~30 minutes in the past,
// using Europe/Warsaw local time (bookings are for physical rooms in Poland
// regardless of the requester's browser timezone). The grace period matters
// because the booking UI's slot grid has 30-minute granularity: someone
// booking "right now" gets a start time from the current (already-started)
// slot, and by the time the request reaches the server a little more time
// has passed — an exact "now" comparison would reject that as past.
export function isPastDateTime(dateStr: string, timeStr: string): boolean {
  const now = nowInWarsaw();
  const elapsed = minutesSinceEpochDay(now.date, now.time) - minutesSinceEpochDay(dateStr, timeStr);
  return elapsed >= 30;
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
