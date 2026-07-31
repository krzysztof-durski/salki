import { useState, useRef } from "react";
import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/admin.serie.$id";
import { ConfirmModal } from "~/components/ConfirmModal";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { isValidDateFormat, isValidTimeFormat, parseAttendeeCount, todayWarsaw } from "~/lib/validation.server";
import { validateRecurrenceFields, generateOccurrenceDates, addMonthsClamped, MAX_SERIES_MONTHS } from "~/lib/recurrence";
import { validateSeriesDateRange, materializeSeriesOccurrences, bulkUpdateSeriesOccurrences } from "~/lib/recurrence.server";
import { canManageBookings, RECURRENCE_TYPE_LABELS, WEEKDAY_LABELS } from "~/types";
import type { BookingSeries, Booking, Room, RecurrenceType } from "~/types";
import { Trash2 } from "lucide-react";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const series = await queryOne<BookingSeries & { room_name: string }>(
    env.DB,
    `SELECT s.*, r.name as room_name FROM booking_series s JOIN rooms r ON r.id = s.room_id WHERE s.id = ?`,
    [params.id]
  );
  if (!series) throw new Response(null, { status: 404 });

  const rooms = await queryAll<Room>(env.DB, "SELECT id, name, category, size_label FROM rooms WHERE is_active = 1 ORDER BY sort_order");

  const today = todayWarsaw();
  const occurrences = await queryAll<Booking>(
    env.DB,
    `SELECT * FROM bookings WHERE series_id = ? ORDER BY date`,
    [series.id]
  );
  const pastOccurrences = occurrences.filter(o => o.date < today);
  const upcomingOccurrences = occurrences.filter(o => o.date >= today);

  const url = new URL(request.url);
  const created = url.searchParams.get("utworzono");
  const updated = url.searchParams.get("zaktualizowano");
  const skipped = url.searchParams.get("pominieto");

  return { series, rooms, pastOccurrences, upcomingOccurrences, today, created, updated, skipped };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const seriesId = parseInt(params.id as string, 10);
  const series = await queryOne<BookingSeries>(env.DB, "SELECT * FROM booking_series WHERE id = ?", [seriesId]);
  if (!series) throw new Response(null, { status: 404 });

  const form = await request.formData();
  const _action = form.get("_action") as string;
  const today = todayWarsaw();

  if (_action === "delete_series") {
    if (series.status !== 'active') return data({ error: "Ta seria nie jest już aktywna." }, { status: 400 });
    await execute(env.DB, "DELETE FROM bookings WHERE series_id = ? AND date >= ?", [seriesId, today]);
    await execute(env.DB, "UPDATE booking_series SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id = ?", [seriesId]);
    await logAction(env.DB, { userId: user.id, action: 'series.deleted', entityType: 'booking_series', entityId: seriesId, request });
    return redirect(`/admin/serie/${seriesId}`);
  }

  if (_action === "edit") {
    if (series.status !== 'active') return data({ error: "Ta seria nie jest już aktywna." }, { status: 400 });

    const roomId = parseInt(form.get("room_id") as string, 10);
    const title = (form.get("title") as string)?.trim() || null;
    const startTime = form.get("start_time") as string;
    const endTime = form.get("end_time") as string;
    const requesterNote = (form.get("requester_note") as string)?.trim() || null;
    const hideDetailsForObserver = form.get("hide_details_for_observer") === "on";
    const seriesEndDate = form.get("series_end_date") as string;
    const recurrenceType = form.get("recurrence_type") as string;
    const weekdayRaw = form.get("weekday") as string | null;
    const monthDayRaw = form.get("month_day") as string | null;

    if (!roomId || !startTime || !endTime || !seriesEndDate) {
      return data({ error: "Wypełnij wymagane pola." }, { status: 400 });
    }
    if (!isValidDateFormat(seriesEndDate)) return data({ error: "Nieprawidłowy format daty." }, { status: 400 });
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return data({ error: "Nieprawidłowy format godziny." }, { status: 400 });
    }
    if (startTime >= endTime) {
      return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
    }
    const attendeeResult = parseAttendeeCount(form.get("attendee_count"));
    if (!attendeeResult.ok) return data({ error: attendeeResult.error }, { status: 400 });
    const attendeeCount = attendeeResult.value;

    const roomRow = await queryOne<{ id: number }>(env.DB, "SELECT id FROM rooms WHERE id = ? AND is_active = 1", [roomId]);
    if (!roomRow) return data({ error: "Nieznana sala." }, { status: 400 });

    const ruleCheck = validateRecurrenceFields(recurrenceType, weekdayRaw, monthDayRaw);
    if (!ruleCheck.ok) return data({ error: ruleCheck.error }, { status: 400 });

    const patternChanged =
      ruleCheck.rule.type !== series.recurrence_type ||
      ruleCheck.rule.weekday !== series.weekday ||
      ruleCheck.rule.monthDay !== series.month_day;

    if (patternChanged) {
      // A pattern change means every future occurrence is generated by a
      // different rule going forward — split into a new series rather than
      // reinterpreting historical rows under a rule that never produced them.
      const rangeCheck = validateSeriesDateRange(today, seriesEndDate, startTime);
      if (!rangeCheck.ok) return data({ error: rangeCheck.error }, { status: 400 });

      const candidateDates = generateOccurrenceDates(ruleCheck.rule, today, seriesEndDate);
      if (candidateDates.length === 0) {
        return data({ error: "Wybrane ustawienia nie generują żadnych terminów w podanym zakresie dat." }, { status: 400 });
      }

      await execute(env.DB, "DELETE FROM bookings WHERE series_id = ? AND date >= ?", [seriesId, today]);

      const newSeriesResult = await execute(
        env.DB,
        `INSERT INTO booking_series
           (room_id, created_by_admin_id, requester_id, title, start_time, end_time, attendee_count,
            requester_note, recurrence_type, weekday, month_day, series_start_date, series_end_date,
            status, supersedes_series_id, hide_details_for_observer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          roomId, user.id, user.id, title, startTime, endTime, attendeeCount, requesterNote,
          ruleCheck.rule.type, ruleCheck.rule.weekday, ruleCheck.rule.monthDay, today, seriesEndDate, seriesId,
          hideDetailsForObserver ? 1 : 0,
        ]
      );
      const newSeriesId = newSeriesResult.meta.last_row_id as number;

      await execute(
        env.DB,
        "UPDATE booking_series SET status='superseded', superseded_by_series_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [newSeriesId, seriesId]
      );

      const { createdDates, skippedDates } = await materializeSeriesOccurrences(env.DB, {
        seriesId: newSeriesId, roomId, requesterId: user.id, adminId: user.id, title, startTime, endTime,
        attendeeCount, requesterNote, hideDetailsForObserver, candidateDates,
      });

      await logAction(env.DB, {
        userId: user.id, action: 'series.split', entityType: 'booking_series', entityId: newSeriesId,
        details: { oldSeriesId: seriesId, createdCount: createdDates.length, skippedDates },
        request,
      });

      const qp = new URLSearchParams({ utworzono: String(createdDates.length) });
      if (skippedDates.length) qp.set("pominieto", skippedDates.join(","));
      return redirect(`/admin/serie/${newSeriesId}?${qp.toString()}`);
    }

    // Pattern unchanged — adjust the date range if needed, then bulk-update content.
    const rangeCheck = validateSeriesDateRange(series.series_start_date < today ? today : series.series_start_date, seriesEndDate, startTime);
    if (!rangeCheck.ok) return data({ error: rangeCheck.error }, { status: 400 });

    let extraCreated: string[] = [];
    let extraSkipped: string[] = [];
    if (seriesEndDate < series.series_end_date) {
      await execute(env.DB, "DELETE FROM bookings WHERE series_id = ? AND date > ?", [seriesId, seriesEndDate]);
    } else if (seriesEndDate > series.series_end_date) {
      const rangeStart = series.series_end_date > today ? series.series_end_date : today;
      const extraDates = generateOccurrenceDates(ruleCheck.rule, rangeStart, seriesEndDate)
        .filter(d => d > series.series_end_date);
      const result = await materializeSeriesOccurrences(env.DB, {
        seriesId, roomId, requesterId: user.id, adminId: user.id, title, startTime, endTime,
        attendeeCount, requesterNote, hideDetailsForObserver, candidateDates: extraDates,
      });
      extraCreated = result.createdDates;
      extraSkipped = result.skippedDates;
    }

    await execute(
      env.DB,
      `UPDATE booking_series
       SET room_id=?, title=?, start_time=?, end_time=?, attendee_count=?, requester_note=?,
           series_end_date=?, hide_details_for_observer=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [roomId, title, startTime, endTime, attendeeCount, requesterNote, seriesEndDate, hideDetailsForObserver ? 1 : 0, seriesId]
    );

    const { updatedDates, skippedConflict, skippedException } = await bulkUpdateSeriesOccurrences(env.DB, {
      seriesId, fromDate: today, roomId, title, startTime, endTime, attendeeCount, requesterNote, hideDetailsForObserver,
    });

    await logAction(env.DB, {
      userId: user.id, action: 'series.bulk_edited', entityType: 'booking_series', entityId: seriesId,
      details: { updatedCount: updatedDates.length, skippedConflict, skippedException, extraCreatedCount: extraCreated.length, extraSkipped },
      request,
    });

    const qp = new URLSearchParams({ zaktualizowano: String(updatedDates.length + extraCreated.length) });
    const allSkipped = [...skippedConflict, ...extraSkipped];
    if (allSkipped.length) qp.set("pominieto", allSkipped.join(","));
    return redirect(`/admin/serie/${seriesId}?${qp.toString()}`);
  }

  return redirect(`/admin/serie/${seriesId}`);
}

function describeRule(s: BookingSeries): string {
  if (s.recurrence_type === 'weekly') return `Co tydzień, ${WEEKDAY_LABELS[s.weekday!]}`;
  if (s.recurrence_type === 'monthly_fixed_day') return `Co miesiąc, dzień ${s.month_day}`;
  return `Co miesiąc, pierwszy ${WEEKDAY_LABELS[s.weekday!]} od dnia ${s.month_day}`;
}

const STATUS_LABEL: Record<string, string> = { active: 'Aktywna', cancelled: 'Anulowana', superseded: 'Zastąpiona' };

export default function AdminSeriaDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { series, rooms, pastOccurrences, upcomingOccurrences, today, created, updated, skipped } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(series.recurrence_type);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const isActive = series.status === 'active';

  const skippedDates = skipped ? skipped.split(",") : [];

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Seria: {series.room_name}</h1>
        <Link to="/admin/serie" className="text-sm text-gray-500 hover:text-gray-700">← Serie cykliczne</Link>
      </div>

      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
        {STATUS_LABEL[series.status]}
      </div>

      {created && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Utworzono {created} terminów.
        </p>
      )}
      {updated && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Zaktualizowano {updated} terminów.
        </p>
      )}
      {skippedDates.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Pominięto {skippedDates.length} termin(y/ów) z powodu konfliktu z inną rezerwacją: {skippedDates.join(", ")}
        </p>
      )}

      {series.supersedes_series_id && (
        <p className="text-sm text-gray-500">
          Kontynuacja serii <Link to={`/admin/serie/${series.supersedes_series_id}`} className="text-blue-600 hover:underline">#{series.supersedes_series_id}</Link> (zmieniona reguła powtarzania).
        </p>
      )}
      {series.superseded_by_series_id && (
        <p className="text-sm text-gray-500">
          Zastąpiona przez serię <Link to={`/admin/serie/${series.superseded_by_series_id}`} className="text-blue-600 hover:underline">#{series.superseded_by_series_id}</Link>.
        </p>
      )}

      {isActive ? (
        <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <input type="hidden" name="_action" value="edit" />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
            <select name="room_id" defaultValue={series.room_id} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł spotkania</label>
            <input name="title" type="text" defaultValue={series.title ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Od *</label>
              <input name="start_time" type="time" required defaultValue={series.start_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Do *</label>
              <input name="end_time" type="time" required defaultValue={series.end_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liczba uczestników</label>
            <input name="attendee_count" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={series.attendee_count ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi</label>
            <textarea name="requester_note" rows={2} defaultValue={series.requester_note ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                name="hide_details_for_observer"
                defaultChecked={series.hide_details_for_observer === 1}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Ukryj detale rezerwacji dla Obserwatora
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              * W widoku Obserwatora terminy tej serii pojawią się jako "Blokada", bez tytułu i innych szczegółów.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-5 space-y-4">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Zmiana typu powtarzania / dnia poniżej zakończy tę serię od dzisiaj i utworzy nową — terminy historyczne pozostaną nienaruszone.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ powtarzania *</label>
              <select
                name="recurrence_type"
                value={recurrenceType}
                onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {Object.entries(RECURRENCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {(recurrenceType === "weekly" || recurrenceType === "monthly_nth_weekday") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dzień tygodnia *</label>
                <select name="weekday" required defaultValue={series.weekday ?? undefined} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                    <option key={value} value={value} className="capitalize">{label}</option>
                  ))}
                </select>
              </div>
            )}

            {(recurrenceType === "monthly_fixed_day" || recurrenceType === "monthly_nth_weekday") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {recurrenceType === "monthly_fixed_day" ? "Dzień miesiąca *" : "Od dnia miesiąca (kotwica) *"}
                </label>
                <input name="month_day" type="number" min={1} max={31} required defaultValue={series.month_day ?? undefined} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data zakończenia serii *</label>
              <input
                name="series_end_date"
                type="date"
                required
                defaultValue={series.series_end_date}
                max={addMonthsClamped(series.series_start_date < today ? today : series.series_start_date, MAX_SERIES_MONTHS)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {actionData?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
          )}

          <button type="submit" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {pending ? "Zapisuję…" : "Zapisz zmiany (od dzisiaj)"}
          </button>
        </Form>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-2 shadow-sm text-sm text-gray-600">
          <p>Reguła: {describeRule(series)}, {series.start_time}–{series.end_time}</p>
          <p>Okres: {series.series_start_date} – {series.series_end_date}</p>
        </div>
      )}

      {isActive && (
        <Form method="post" ref={deleteFormRef}>
          <input type="hidden" name="_action" value="delete_series" />
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 size={14} /> Usuń serię (od dzisiaj)
          </button>
        </Form>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Nadchodzące terminy ({upcomingOccurrences.length})</h2>
        <OccurrenceTable occurrences={upcomingOccurrences} />
      </div>

      {pastOccurrences.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Terminy historyczne — niemodyfikowalne ({pastOccurrences.length})</h2>
          <OccurrenceTable occurrences={pastOccurrences} />
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Usunąć wszystkie nadchodzące terminy tej serii (od dzisiaj)? Terminy z przeszłości pozostaną nienaruszone. Operacja jest nieodwracalna."
          onConfirm={() => { deleteFormRef.current?.requestSubmit(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function OccurrenceTable({ occurrences }: { occurrences: Booking[] }) {
  if (occurrences.length === 0) return <p className="text-sm text-gray-400">Brak terminów.</p>;
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2">Data</th>
            <th className="text-left px-4 py-2">Godziny</th>
            <th className="text-left px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {occurrences.map(o => (
            <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2">
                <Link to={`/rezerwacje/${o.id}`} className="text-blue-600 hover:underline">{o.date}</Link>
                {o.series_exception === 1 && <span className="ml-2 text-xs text-amber-600">(zmodyfikowany osobno)</span>}
              </td>
              <td className="px-4 py-2 text-gray-700">{o.start_time}–{o.end_time}</td>
              <td className="px-4 py-2 text-gray-500">{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
