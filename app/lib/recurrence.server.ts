import { batch, queryAll } from './db.server';
import { isPastDateTime, todayWarsaw } from './validation.server';
import { addMonthsClamped, MAX_SERIES_MONTHS } from './recurrence';

export function validateSeriesDateRange(
  seriesStartDate: string,
  seriesEndDate: string,
  startTime: string
): { ok: true } | { ok: false; error: string } {
  const today = todayWarsaw();
  if (seriesStartDate < today) {
    return { ok: false, error: 'Data rozpoczęcia serii nie może być w przeszłości.' };
  }
  if (seriesEndDate < seriesStartDate) {
    return { ok: false, error: 'Data zakończenia serii musi być późniejsza niż data rozpoczęcia.' };
  }
  const maxEnd = addMonthsClamped(seriesStartDate, MAX_SERIES_MONTHS);
  if (seriesEndDate > maxEnd) {
    return { ok: false, error: `Seria może trwać maksymalnie ${MAX_SERIES_MONTHS} miesięcy od daty rozpoczęcia.` };
  }
  if (seriesStartDate === today && isPastDateTime(seriesStartDate, startTime)) {
    return { ok: false, error: 'Nie można rozpocząć serii w przeszłości.' };
  }
  return { ok: true };
}

export interface MaterializeParams {
  seriesId: number;
  roomId: number;
  requesterId: number;
  adminId: number;
  title: string | null;
  startTime: string;
  endTime: string;
  attendeeCount: number | null;
  requesterNote: string | null;
  hideDetailsForObserver: boolean;
  candidateDates: string[];
}

export interface MaterializeResult {
  createdDates: string[];
  skippedDates: string[];
}

// Batch-inserts one booking row per candidate date, atomically skipping any
// date that already has a conflicting approved booking in that room (same
// NOT-EXISTS pattern used by the single direct-booking INSERT in
// rezerwacje.nowa.tsx) — conflicts are reported back, not treated as an error.
export async function materializeSeriesOccurrences(
  db: CloudflareEnv['DB'],
  params: MaterializeParams
): Promise<MaterializeResult> {
  const { seriesId, roomId, requesterId, adminId, title, startTime, endTime, attendeeCount, requesterNote, hideDetailsForObserver, candidateDates } = params;
  if (candidateDates.length === 0) return { createdDates: [], skippedDates: [] };

  const stmts = candidateDates.map(date =>
    db.prepare(
      `INSERT INTO bookings
         (room_id, requester_id, created_by_admin_id, title, series_id, date, start_time, end_time,
          attendee_count, status, requester_note, hide_details_for_observer)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings b2
         WHERE b2.room_id = ? AND b2.date = ? AND b2.status = 'approved'
           AND b2.start_time < ? AND b2.end_time > ?
       )`
    ).bind(
      roomId, requesterId, adminId, title, seriesId, date, startTime, endTime, attendeeCount, requesterNote, hideDetailsForObserver ? 1 : 0,
      roomId, date, endTime, startTime
    )
  );

  const results = await batch(db, stmts);
  const createdDates: string[] = [];
  const skippedDates: string[] = [];
  results.forEach((r, i) => {
    if (r.meta.changes) createdDates.push(candidateDates[i]);
    else skippedDates.push(candidateDates[i]);
  });
  return { createdDates, skippedDates };
}

export interface BulkUpdateParams {
  seriesId: number;
  fromDate: string; // caller must clamp this to todayWarsaw() before calling
  roomId: number;
  title: string | null;
  startTime: string;
  endTime: string;
  attendeeCount: number | null;
  requesterNote: string | null;
  hideDetailsForObserver: boolean;
}

export interface BulkUpdateResult {
  updatedDates: string[];
  skippedConflict: string[];
  skippedException: string[];
}

// Bulk-updates content fields (room/title/time/attendees/note — never date or
// recurrence pattern) across every occurrence of a series from fromDate
// onward. Rows individually customized via a "this event only" edit
// (series_exception=1) are left untouched and reported separately, so a
// deliberately-customized occurrence is never silently overwritten.
export async function bulkUpdateSeriesOccurrences(
  db: CloudflareEnv['DB'],
  params: BulkUpdateParams
): Promise<BulkUpdateResult> {
  const { seriesId, fromDate, roomId, title, startTime, endTime, attendeeCount, requesterNote, hideDetailsForObserver } = params;

  const rows = await queryAll<{ id: number; date: string; series_exception: number }>(
    db,
    `SELECT id, date, series_exception FROM bookings WHERE series_id = ? AND date >= ? ORDER BY date`,
    [seriesId, fromDate]
  );

  const targets = rows.filter(r => r.series_exception === 0);
  const skippedException = rows.filter(r => r.series_exception === 1).map(r => r.date);
  if (targets.length === 0) return { updatedDates: [], skippedConflict: [], skippedException };

  const stmts = targets.map(row =>
    db.prepare(
      `UPDATE bookings
       SET room_id=?, title=?, start_time=?, end_time=?, attendee_count=?, requester_note=?, hide_details_for_observer=?,
           version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b2
           WHERE b2.room_id=? AND b2.date=bookings.date AND b2.status='approved'
             AND b2.id != bookings.id AND b2.start_time < ? AND b2.end_time > ?
         )`
    ).bind(roomId, title, startTime, endTime, attendeeCount, requesterNote, hideDetailsForObserver ? 1 : 0, row.id, roomId, endTime, startTime)
  );

  const results = await batch(db, stmts);
  const updatedDates: string[] = [];
  const skippedConflict: string[] = [];
  results.forEach((r, i) => {
    if (r.meta.changes) updatedDates.push(targets[i].date);
    else skippedConflict.push(targets[i].date);
  });

  return { updatedDates, skippedConflict, skippedException };
}
