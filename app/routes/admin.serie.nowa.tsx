import { useState } from "react";
import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/admin.serie.nowa";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { canManageBookings, RECURRENCE_TYPE_LABELS, WEEKDAY_LABELS } from "~/types";
import type { Room, RecurrenceType } from "~/types";
import { isValidDateFormat, isValidTimeFormat, parseAttendeeCount } from "~/lib/validation.server";
import { validateRecurrenceFields, generateOccurrenceDates, addMonthsClamped, MAX_SERIES_MONTHS } from "~/lib/recurrence";
import { validateSeriesDateRange, materializeSeriesOccurrences } from "~/lib/recurrence.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const url = new URL(request.url);
  const prefilledRoom = url.searchParams.get("sala");
  const prefilledDate = url.searchParams.get("data") ?? "";

  const rooms = await queryAll<Room>(
    env.DB,
    "SELECT id, name, category, size_label FROM rooms WHERE is_active = 1 ORDER BY sort_order"
  );

  return { user, rooms, prefilledRoom, prefilledDate };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const form = await request.formData();
  const roomId = parseInt(form.get("room_id") as string, 10);
  const title = (form.get("title") as string)?.trim() || null;
  const startTime = form.get("start_time") as string;
  const endTime = form.get("end_time") as string;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;
  const hideDetailsForObserver = form.get("hide_details_for_observer") === "on";
  const seriesStartDate = form.get("series_start_date") as string;
  const seriesEndDate = form.get("series_end_date") as string;
  const recurrenceType = form.get("recurrence_type") as string;
  const weekdayRaw = form.get("weekday") as string | null;
  const monthDayRaw = form.get("month_day") as string | null;

  if (!roomId || !startTime || !endTime || !seriesStartDate || !seriesEndDate) {
    return data({ error: "Wypełnij wymagane pola." }, { status: 400 });
  }
  if (!isValidDateFormat(seriesStartDate) || !isValidDateFormat(seriesEndDate)) {
    return data({ error: "Nieprawidłowy format daty." }, { status: 400 });
  }
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    return data({ error: "Nieprawidłowy format godziny." }, { status: 400 });
  }
  if (startTime >= endTime) {
    return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
  }
  const attendeeResult = parseAttendeeCount(form.get("attendee_count"));
  if (!attendeeResult.ok) {
    return data({ error: attendeeResult.error }, { status: 400 });
  }
  const attendeeCount = attendeeResult.value;

  const rangeCheck = validateSeriesDateRange(seriesStartDate, seriesEndDate, startTime);
  if (!rangeCheck.ok) return data({ error: rangeCheck.error }, { status: 400 });

  const ruleCheck = validateRecurrenceFields(recurrenceType, weekdayRaw, monthDayRaw);
  if (!ruleCheck.ok) return data({ error: ruleCheck.error }, { status: 400 });

  const roomRow = await queryAll<{ id: number }>(env.DB, "SELECT id FROM rooms WHERE id = ? AND is_active = 1", [roomId]);
  if (roomRow.length === 0) return data({ error: "Nieznana sala." }, { status: 400 });

  const candidateDates = generateOccurrenceDates(ruleCheck.rule, seriesStartDate, seriesEndDate);
  if (candidateDates.length === 0) {
    return data({ error: "Wybrane ustawienia nie generują żadnych terminów w podanym zakresie dat." }, { status: 400 });
  }

  const seriesResult = await execute(
    env.DB,
    `INSERT INTO booking_series
       (room_id, created_by_admin_id, requester_id, title, start_time, end_time, attendee_count,
        requester_note, recurrence_type, weekday, month_day, series_start_date, series_end_date, status, hide_details_for_observer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      roomId, user.id, user.id, title, startTime, endTime, attendeeCount, requesterNote,
      ruleCheck.rule.type, ruleCheck.rule.weekday, ruleCheck.rule.monthDay, seriesStartDate, seriesEndDate,
      hideDetailsForObserver ? 1 : 0,
    ]
  );
  const seriesId = seriesResult.meta.last_row_id as number;

  const { createdDates, skippedDates } = await materializeSeriesOccurrences(env.DB, {
    seriesId, roomId, requesterId: user.id, adminId: user.id, title, startTime, endTime,
    attendeeCount, requesterNote, hideDetailsForObserver, candidateDates,
  });

  await logAction(env.DB, {
    userId: user.id,
    action: 'series.created',
    entityType: 'booking_series',
    entityId: seriesId,
    details: { roomId, recurrenceType: ruleCheck.rule.type, weekday: ruleCheck.rule.weekday, monthDay: ruleCheck.rule.monthDay, seriesStartDate, seriesEndDate, createdCount: createdDates.length, skippedDates },
    request,
  });

  const params = new URLSearchParams({ utworzono: String(createdDates.length) });
  if (skippedDates.length) params.set("pominieto", skippedDates.join(","));
  return redirect(`/admin/serie/${seriesId}?${params.toString()}`);
}

export default function NowaSeria({ loaderData, actionData }: Route.ComponentProps) {
  const { rooms, prefilledRoom, prefilledDate } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("weekly");
  const [seriesStartDate, setSeriesStartDate] = useState(prefilledDate);
  const maxEndDate = seriesStartDate ? addMonthsClamped(seriesStartDate, MAX_SERIES_MONTHS) : undefined;

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nowa seria cykliczna</h1>
        <Link to="/admin/serie" className="text-sm text-gray-500 hover:text-gray-700">← Serie cykliczne</Link>
      </div>

      <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
          <select
            name="room_id"
            required
            defaultValue={prefilledRoom ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">— wybierz salę —</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.size_label ? ` (${r.size_label})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł spotkania</label>
          <input
            name="title"
            type="text"
            placeholder="np. Cotygodniowy status"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od *</label>
            <input name="start_time" type="time" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do *</label>
            <input name="end_time" type="time" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Liczba uczestników</label>
          <input
            name="attendee_count"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Uwagi <span className="text-gray-400 font-normal">(opcjonalnie)</span>
          </label>
          <textarea
            name="requester_note"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="hide_details_for_observer"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Ukryj detale rezerwacji dla Obserwatora
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6">
            * W widoku Obserwatora terminy tej serii pojawią się jako "Blokada", bez tytułu i innych szczegółów.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-5 space-y-4">
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
              <select name="weekday" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
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
              <input
                name="month_day"
                type="number"
                min={1}
                max={31}
                required
                placeholder="np. 15"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {recurrenceType === "monthly_nth_weekday" && (
                <p className="text-xs text-gray-400 mt-1">Pierwsze wystąpienie wybranego dnia tygodnia od tej daty (włącznie) w każdym miesiącu.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data rozpoczęcia serii *</label>
              <input
                name="series_start_date"
                type="date"
                required
                value={seriesStartDate}
                onChange={e => setSeriesStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data zakończenia serii *</label>
              <input
                name="series_end_date"
                type="date"
                required
                max={maxEndDate}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">Seria może trwać maksymalnie {MAX_SERIES_MONTHS} miesięcy od daty rozpoczęcia. Terminy przypadające na weekend są pomijane.</p>
        </div>

        {actionData?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {actionData.error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {pending ? "Tworzę…" : "Utwórz serię"}
          </button>
          <Link to="/admin/serie" className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Anuluj
          </Link>
        </div>
      </Form>
    </div>
  );
}
