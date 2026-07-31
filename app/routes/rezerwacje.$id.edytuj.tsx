import { useState } from "react";
import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.$id.edytuj";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { notifyRequester } from "~/lib/notify.server";
import { isAdmin, RECURRENCE_TYPE_LABELS, WEEKDAY_LABELS } from "~/types";
import type { Booking, Room, BookingSeries } from "~/types";
import { isValidDateFormat, isValidTimeFormat, isPastDateTime, parseAttendeeCount, todayWarsaw } from "~/lib/validation.server";
import { bulkUpdateSeriesOccurrences } from "~/lib/recurrence.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const booking = await queryOne<Booking & { requester_name: string; requester_email: string }>(
    env.DB,
    `SELECT b.*, r.name as room_name, u.name as requester_name, u.email as requester_email
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     WHERE b.id = ?`,
    [params.id]
  );
  if (!booking) throw new Response(null, { status: 404 });

  const adminUser = isAdmin(user.role);

  // Regular users: can only edit their own pending booking
  if (!adminUser) {
    if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
    if (booking.status !== 'pending') return redirect(`/rezerwacje/${booking.id}`);
  }

  const rooms = adminUser
    ? await queryAll<Room>(env.DB, "SELECT id, name, category FROM rooms WHERE is_active=1 ORDER BY sort_order")
    : null;

  const series = booking.series_id
    ? await queryOne<BookingSeries>(env.DB, "SELECT * FROM booking_series WHERE id = ?", [booking.series_id])
    : null;

  return { booking, isAdminUser: adminUser, rooms, series, today: todayWarsaw() };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const version = parseInt(form.get("version") as string, 10);
  const roomId = form.get("room_id") ? parseInt(form.get("room_id") as string, 10) : null;
  const date = form.get("date") as string;
  const startTime = form.get("start_time") as string;
  const endTime = form.get("end_time") as string;
  const title = (form.get("title") as string)?.trim() || null;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;
  const adminNote = (form.get("admin_note") as string)?.trim() || null;
  const hideDetailsForObserver = form.get("hide_details_for_observer") === "on";
  const editScope = (form.get("edit_scope") as string) || 'single';
  const bookingId = parseInt(params.id as string, 10);
  const adminUser = isAdmin(user.role);

  const booking = await queryOne<Booking & { requester_email: string; room_name: string }>(
    env.DB,
    `SELECT b.*, u.email as requester_email, r.name as room_name FROM bookings b JOIN users u ON u.id=b.requester_id JOIN rooms r ON r.id=b.room_id WHERE b.id=?`,
    [bookingId]
  );
  if (!booking) throw new Response(null, { status: 404 });

  if (!adminUser && booking.requester_id !== user.id) throw new Response(null, { status: 403 });

  if (!date || !startTime || !endTime) {
    return data({ error: "Wypełnij wymagane pola." }, { status: 400 });
  }
  if (!isValidDateFormat(date)) {
    return data({ error: "Nieprawidłowy format daty." }, { status: 400 });
  }
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    return data({ error: "Nieprawidłowy format godziny." }, { status: 400 });
  }
  if (startTime >= endTime) {
    return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
  }
  if (isPastDateTime(date, startTime)) {
    return data({ error: "Nie można rezerwować terminów w przeszłości." }, { status: 400 });
  }
  const attendeeResult = parseAttendeeCount(form.get("attendee_count"));
  if (!attendeeResult.ok) {
    return data({ error: attendeeResult.error }, { status: 400 });
  }
  const attendeeCount = attendeeResult.value;

  // Admin-supplied room must exist and be active
  let targetRoomId = booking.room_id;
  let targetRoomName = booking.room_name;
  if (adminUser && roomId) {
    const targetRoom = await queryOne<{ id: number; name: string }>(env.DB, "SELECT id, name FROM rooms WHERE id = ? AND is_active = 1", [roomId]);
    if (!targetRoom) return data({ error: "Nieprawidłowa lub nieaktywna sala." }, { status: 400 });
    targetRoomId = targetRoom.id;
    targetRoomName = targetRoom.name;
  }

  if (adminUser && booking.series_id && editScope !== 'single') {
    // Bulk edit across a recurring series — content fields only (never date
    // or the recurrence pattern itself), always clamped to today-or-later so
    // past occurrences are never touched.
    const today = todayWarsaw();
    const threshold = editScope === 'future'
      ? (booking.date > today ? booking.date : today)
      : today;

    const { updatedDates, skippedConflict, skippedException } = await bulkUpdateSeriesOccurrences(env.DB, {
      seriesId: booking.series_id, fromDate: threshold, roomId: targetRoomId, title, startTime, endTime,
      attendeeCount, requesterNote, hideDetailsForObserver,
    });

    await logAction(env.DB, {
      userId: user.id, action: 'series.bulk_edited', entityType: 'booking_series', entityId: booking.series_id,
      details: { updatedCount: updatedDates.length, skippedConflict, skippedException, scope: editScope },
      request,
    });

    const qp = new URLSearchParams({ zaktualizowano: String(updatedDates.length) });
    if (skippedConflict.length) qp.set("pominieto", skippedConflict.join(","));
    return redirect(`/admin/serie/${booking.series_id}?${qp.toString()}`);
  }

  if (adminUser) {
    // Admins can edit any booking; overlap check and version check folded
    // into one atomic UPDATE via NOT EXISTS, closing the race window between
    // a separate check and this write. Editing a single occurrence of a
    // series flags it as an exception so future bulk edits skip it.
    const result = await execute(
      env.DB,
      `UPDATE bookings
       SET room_id=?, date=?, start_time=?, end_time=?, title=?, attendee_count=?,
           requester_note=?, admin_note=?, hide_details_for_observer=?,
           series_exception=CASE WHEN series_id IS NOT NULL THEN 1 ELSE series_exception END,
           version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b2
           WHERE b2.room_id = ? AND b2.date = ? AND b2.status = 'approved'
             AND b2.id != bookings.id AND b2.start_time < ? AND b2.end_time > ?
         )`,
      [targetRoomId, date, startTime, endTime, title, attendeeCount, requesterNote, adminNote, hideDetailsForObserver ? 1 : 0,
       bookingId, version,
       targetRoomId, date, endTime, startTime]
    );
    if (!result.meta.changes) {
      return data({ error: "Konflikt — ktoś inny zmodyfikował tę rezerwację, lub termin jest już zajęty. Odśwież i spróbuj ponownie." }, { status: 409 });
    }

    // "Already confirmed reservation changed by admin" only applies when the
    // booking was already approved before this edit — a pending request
    // being edited isn't a confirmed-then-changed event.
    if (booking.status === 'approved') {
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      if (targetRoomId !== booking.room_id) diff.room = { from: booking.room_name, to: targetRoomName };
      if (date !== booking.date) diff.date = { from: booking.date, to: date };
      if (startTime !== booking.start_time || endTime !== booking.end_time) {
        diff.hours = { from: `${booking.start_time}–${booking.end_time}`, to: `${startTime}–${endTime}` };
      }
      if ((title ?? null) !== (booking.title ?? null)) diff.title = { from: booking.title, to: title };
      if (attendeeCount !== booking.attendee_count) diff.attendees = { from: booking.attendee_count, to: attendeeCount };
      if ((requesterNote ?? null) !== (booking.requester_note ?? null)) diff.note = { from: booking.requester_note, to: requesterNote };

      if (Object.keys(diff).length > 0) {
        await notifyRequester(env, bookingId, booking.requester_id, 'booking_modified', JSON.stringify(diff));
      }
    }

  } else {
    // Regular user: only pending, own booking, no room change. Atomicity
    // here is mainly UX-correctness (this row stays 'pending' either way)
    // but kept consistent with the admin path above.
    const result = await execute(
      env.DB,
      `UPDATE bookings
       SET date=?, start_time=?, end_time=?, title=?, attendee_count=?,
           requester_note=?, hide_details_for_observer=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='pending' AND requester_id=?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b2
           WHERE b2.room_id = bookings.room_id AND b2.date = ? AND b2.status = 'approved'
             AND b2.id != bookings.id AND b2.start_time < ? AND b2.end_time > ?
         )`,
      [date, startTime, endTime, title, attendeeCount, requesterNote, hideDetailsForObserver ? 1 : 0, bookingId, version, user.id,
       date, endTime, startTime]
    );
    if (!result.meta.changes) {
      return data({
        error: "Twój wniosek został właśnie przetworzony przez administratora, lub termin jest już zajęty. Edycja nie jest możliwa.",
      }, { status: 409 });
    }
  }

  await logAction(env.DB, {
    userId: user.id,
    action: 'booking.edited',
    entityType: 'booking',
    entityId: bookingId,
    details: { date, startTime, endTime, editedByAdmin: adminUser },
    request,
  });

  return redirect(`/rezerwacje/${bookingId}`);
}

const EDIT_SCOPE_OPTIONS: { value: 'single' | 'future' | 'all'; label: string }[] = [
  { value: 'single', label: 'Tylko ten termin' },
  { value: 'future', label: 'Ten i wszystkie przyszłe terminy' },
  { value: 'all', label: 'Wszystkie terminy w serii' },
];

export default function EdytujRezerwacje({ loaderData, actionData }: Route.ComponentProps) {
  const { booking, isAdminUser, rooms, series, today } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const [editScope, setEditScope] = useState<'single' | 'future' | 'all'>('single');
  const canChooseScope = isAdminUser && booking.series_id != null && booking.date >= today;

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdminUser ? "Edytuj rezerwację" : "Edytuj wniosek"}
        </h1>
        <Link to={`/rezerwacje/${booking.id}`} className="text-sm text-gray-500 hover:text-gray-700">Anuluj</Link>
      </div>

      {series && (
        <p className="text-sm text-gray-500 mb-4">
          Część serii cyklicznej: {RECURRENCE_TYPE_LABELS[series.recurrence_type]}
          {series.weekday != null ? `, ${WEEKDAY_LABELS[series.weekday]}` : ""}
          {" "}{series.start_time}–{series.end_time}.{" "}
          <Link to={`/admin/serie/${series.id}`} className="text-blue-600 hover:underline">Zobacz serię →</Link>
        </p>
      )}

      <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <input type="hidden" name="version" value={booking.version} />

        {canChooseScope && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">Zakres zmiany</p>
            {EDIT_SCOPE_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="radio"
                  name="edit_scope"
                  value={opt.value}
                  checked={editScope === opt.value}
                  onChange={() => setEditScope(opt.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {/* Room picker — admin only */}
        {isAdminUser && rooms ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
            <select
              name="room_id"
              defaultValue={booking.room_id}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sala: <strong>{booking.room_name}</strong></p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł spotkania</label>
          <input name="title" type="text" defaultValue={booking.title ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        {editScope === 'single' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input name="date" type="date" required defaultValue={booking.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        ) : (
          <>
            <input type="hidden" name="date" value={booking.date} />
            <p className="text-xs text-gray-500">Data pozostaje bez zmian dla wielu terminów — każdy zachowuje swój dzień wg reguły serii.</p>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od *</label>
            <input name="start_time" type="time" required defaultValue={booking.start_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do *</label>
            <input name="end_time" type="time" required defaultValue={booking.end_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Liczba uczestników</label>
          <input name="attendee_count" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={booking.attendee_count ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi zgłaszającego</label>
          <textarea name="requester_note" rows={2} defaultValue={booking.requester_note ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="hide_details_for_observer"
              defaultChecked={booking.hide_details_for_observer === 1}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Ukryj detale rezerwacji dla Obserwatora
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6">
            * W widoku Obserwatora ta rezerwacja pojawi się jako "Blokada", bez tytułu i innych szczegółów.
          </p>
        </div>

        {/* Admin-only section */}
        {isAdminUser && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notatka administratora</label>
              <textarea name="admin_note" rows={2} defaultValue={booking.admin_note ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

          </>
        )}

        {actionData?.error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="font-semibold">Nie udało się zapisać zmian</p>
            <p>{actionData.error}</p>
            <Link to={`/rezerwacje/${booking.id}`} className="text-red-800 underline mt-1 inline-block">
              Zobacz aktualny stan wniosku →
            </Link>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {pending ? "Zapisuję…" : "Zapisz zmiany"}
          </button>
        </div>
      </Form>
    </div>
  );
}
