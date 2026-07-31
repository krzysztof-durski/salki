// Pure recurrence-rule math shared by client components (e.g. computing the
// max end-date attribute) and server route actions. No server-only imports —
// this file must stay safe to bundle into the client.

export type RecurrenceType = 'weekly' | 'monthly_fixed_day' | 'monthly_nth_weekday';

// "Repeatable for a max of 6 months in advance" — a series' last possible
// occurrence date is capped at series_start_date + 6 months.
export const MAX_SERIES_MONTHS = 6;

export interface RecurrenceRule {
  type: RecurrenceType;
  weekday: number | null;   // 1-5 (Mon-Fri), Date.getUTCDay() convention
  monthDay: number | null;  // 1-31
}

export function daysInMonth(year: number, month1based: number): number {
  // Day 0 of the following (0-based) month == last day of month1based.
  return new Date(Date.UTC(year, month1based, 0)).getUTCDate();
}

export function isWeekendDate(dateStr: string): boolean {
  const day = weekdayOf(dateStr);
  return day === 0 || day === 6;
}

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

function makeDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Adds N calendar months, clamping the day to the target month's last day
// instead of letting JS Date auto-roll into the following month — e.g.
// Aug 31 + 6 months must clamp to the last day of February, not roll into
// March, or the "max 6 months ahead" cap would silently be exceeded.
export function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth1 = (totalMonths % 12) + 1;
  const clampedDay = Math.min(d, daysInMonth(targetYear, targetMonth1));
  return makeDate(targetYear, targetMonth1, clampedDay);
}

// Generates every occurrence date for a recurrence rule within [startDate, endDate]
// (inclusive, both YYYY-MM-DD). Weekly/monthly_nth_weekday can never land on a
// weekend since `weekday` is restricted to 1-5 at validation time; only
// monthly_fixed_day needs a runtime weekend check, and per product decision
// that month's occurrence is simply omitted (no substitute date).
export function generateOccurrenceDates(rule: RecurrenceRule, startDate: string, endDate: string): string[] {
  const dates: string[] = [];

  if (rule.type === 'weekly') {
    const targetWeekday = rule.weekday!;
    let d = startDate;
    for (let i = 0; i < 7; i++) {
      if (weekdayOf(d) === targetWeekday) break;
      d = addDays(d, 1);
    }
    while (d <= endDate) {
      dates.push(d);
      d = addDays(d, 7);
    }
    return dates;
  }

  const [startY, startM] = startDate.split('-').map(Number);
  let year = startY;
  let month = startM;

  while (makeDate(year, month, 1) <= endDate) {
    const dim = daysInMonth(year, month);

    if (rule.type === 'monthly_fixed_day') {
      const day = rule.monthDay!;
      if (day <= dim) {
        const candidate = makeDate(year, month, day);
        if (candidate >= startDate && candidate <= endDate && !isWeekendDate(candidate)) {
          dates.push(candidate);
        }
      }
    } else {
      // monthly_nth_weekday: first occurrence of `weekday` on/after anchor `monthDay` (clamped to month length)
      const anchorDay = Math.min(rule.monthDay!, dim);
      let candidate = makeDate(year, month, anchorDay);
      for (let i = 0; i < 7; i++) {
        if (weekdayOf(candidate) === rule.weekday!) break;
        candidate = addDays(candidate, 1);
      }
      if (candidate >= startDate && candidate <= endDate) {
        dates.push(candidate);
      }
    }

    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }

  return dates;
}

export type RecurrenceValidationResult = { ok: true; rule: RecurrenceRule } | { ok: false; error: string };

export function validateRecurrenceFields(
  type: string | null,
  weekdayRaw: string | null,
  monthDayRaw: string | null
): RecurrenceValidationResult {
  if (type !== 'weekly' && type !== 'monthly_fixed_day' && type !== 'monthly_nth_weekday') {
    return { ok: false, error: 'Nieprawidłowy typ powtarzania.' };
  }

  const weekday = weekdayRaw ? parseInt(weekdayRaw, 10) : null;
  const monthDay = monthDayRaw ? parseInt(monthDayRaw, 10) : null;
  const validWeekday = weekday !== null && Number.isInteger(weekday) && weekday >= 1 && weekday <= 5;
  const validMonthDay = monthDay !== null && Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31;

  if (type === 'weekly') {
    if (!validWeekday) return { ok: false, error: 'Wybierz dzień tygodnia.' };
    return { ok: true, rule: { type, weekday, monthDay: null } };
  }
  if (type === 'monthly_fixed_day') {
    if (!validMonthDay) return { ok: false, error: 'Podaj dzień miesiąca (1-31).' };
    return { ok: true, rule: { type, weekday: null, monthDay } };
  }
  if (!validWeekday || !validMonthDay) {
    return { ok: false, error: 'Podaj dzień tygodnia oraz dzień miesiąca (kotwicę).' };
  }
  return { ok: true, rule: { type, weekday, monthDay } };
}
