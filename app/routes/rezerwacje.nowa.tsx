import { useState } from "react";
import { redirect, data, Form, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.nowa";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll, queryOne, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { canDirectBookBoardRoom, canDirectBookGeneralRoom, canViewBoardRooms, canManageBookings } from "~/types";
import type { Room, User } from "~/types";
import { notifyAdmins } from "~/lib/notify.server";
import { isValidDateFormat, isValidTimeFormat, isPastDateTime, parseAttendeeCount } from "~/lib/validation.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const url = new URL(request.url);
  const prefilledRoom = url.searchParams.get("sala");
  const prefilledDate = url.searchParams.get("data") ?? "";
  const prefilledFrom = url.searchParams.get("od") ?? "";
  const prefilledTo = url.searchParams.get("do") ?? "";

  const allRooms = await queryAll<Room>(
    env.DB,
    "SELECT id, name, category, size_label FROM rooms WHERE is_active = 1 ORDER BY sort_order"
  );

  // Workers and directors can only book general rooms via request
  const bookableRooms = allRooms.filter(r => {
    if (r.category === 'board') return canDirectBookBoardRoom(user.role);
    return true;
  });

  return { user, rooms: bookableRooms, prefilledRoom, prefilledDate, prefilledFrom, prefilledTo };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const roomId = parseInt(form.get("room_id") as string, 10);
  const date = form.get("date") as string;
  const startTime = form.get("start_time") as string;
  const endTime = form.get("end_time") as string;
  const title = (form.get("title") as string)?.trim() || null;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;
  const notifyReception = form.get("notify_reception") === "on";
  const hideDetailsForObserver = form.get("hide_details_for_observer") === "on";

  if (!roomId || !date || !startTime || !endTime) {
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
    return data({ error: "Nie można rezerwować sali w przeszłości." }, { status: 400 });
  }
  const attendeeResult = parseAttendeeCount(form.get("attendee_count"));
  if (!attendeeResult.ok) {
    return data({ error: attendeeResult.error }, { status: 400 });
  }
  const attendeeCount = attendeeResult.value;

  // Room must exist, be active, and be a category this role can reach at all
  const room = await queryOne<Room>(env.DB, "SELECT * FROM rooms WHERE id = ? AND is_active = 1", [roomId]);
  if (!room) return data({ error: "Nieznana sala." }, { status: 400 });
  if (room.category === 'board' && !canViewBoardRooms(user.role)) {
    return data({ error: "Brak uprawnień do rezerwacji tej sali." }, { status: 403 });
  }

  // Fast, friendly early check — not relied on for correctness under races (see atomic INSERT below).
  const overlap = await queryOne<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) as n FROM bookings
     WHERE room_id = ? AND date = ? AND status = 'approved'
       AND start_time < ? AND end_time > ?`,
    [roomId, date, endTime, startTime]
  );
  if ((overlap?.n ?? 0) > 0) {
    return data({ error: "Ta sala jest już zarezerwowana w wybranym terminie. Wybierz inny czas lub salę." }, { status: 409 });
  }

  const isDirect = room.category === 'board'
    ? canDirectBookBoardRoom(user.role)
    : canDirectBookGeneralRoom(user.role);

  const status = isDirect ? 'approved' : 'pending';

  let result: D1Result;
  if (isDirect) {
    // Atomic: only inserts if no conflicting approved booking exists for this
    // room/date/time at the moment of the INSERT itself — closes the race
    // window between the pre-check SELECT above and this write.
    result = await execute(
      env.DB,
      `INSERT INTO bookings
         (room_id, requester_id, created_by_admin_id, title, date, start_time, end_time, attendee_count, status, requester_note, hide_details_for_observer)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings b2
         WHERE b2.room_id = ? AND b2.date = ? AND b2.status = 'approved'
           AND b2.start_time < ? AND b2.end_time > ?
       )`,
      [roomId, user.id, user.id, title, date, startTime, endTime, attendeeCount, status, requesterNote, hideDetailsForObserver ? 1 : 0,
       roomId, date, endTime, startTime]
    );
    if (!result.meta.changes) {
      return data({ error: "Ta sala jest już zarezerwowana w wybranym terminie. Wybierz inny czas lub salę." }, { status: 409 });
    }
  } else {
    // Pending requests don't need atomicity: an admin can only approve one
    // via the atomic UPDATE in rezerwacje.$id.tsx.
    result = await execute(
      env.DB,
      `INSERT INTO bookings
         (room_id, requester_id, created_by_admin_id, title, date, start_time, end_time, attendee_count, status, requester_note, hide_details_for_observer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, user.id, null, title, date, startTime, endTime, attendeeCount, status, requesterNote, hideDetailsForObserver ? 1 : 0]
    );
  }

  const bookingId = result.meta.last_row_id as number;

  await logAction(env.DB, {
    userId: user.id,
    action: isDirect ? 'booking.direct_created' : 'booking.requested',
    entityType: 'booking',
    entityId: bookingId,
    details: { roomId, date, startTime, endTime, status },
    request,
  });

  if (user.role === 'zarzad' && isDirect && notifyReception) {
    await notifyAdmins(env, bookingId, 'zarzad_created');
  }
  if (!isDirect) {
    await notifyAdmins(env, bookingId, 'booking_requested');
  }

  return redirect(`/rezerwacje/${bookingId}`);
}

export default function NowaRezerwacja({ loaderData, actionData }: Route.ComponentProps) {
  const { user, rooms, prefilledRoom, prefilledDate, prefilledFrom, prefilledTo } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const [selectedRoomId, setSelectedRoomId] = useState(prefilledRoom ?? "");
  const selectedRoom = rooms.find(r => String(r.id) === selectedRoomId);
  const isBoard = selectedRoom?.category === 'board';

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nowa rezerwacja</h1>
        {canManageBookings(user.role) && (
          <a href="/admin/serie/nowa" className="text-sm text-blue-600 hover:underline">
            Utwórz serię cykliczną →
          </a>
        )}
      </div>

      <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
          <select
            name="room_id"
            required
            value={selectedRoomId}
            onChange={e => setSelectedRoomId(e.target.value)}
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
            placeholder="np. Spotkanie z klientem"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input
            name="date"
            type="date"
            required
            defaultValue={prefilledDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od *</label>
            <input
              name="start_time"
              type="time"
              required
              defaultValue={prefilledFrom}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do *</label>
            <input
              name="end_time"
              type="time"
              required
              defaultValue={prefilledTo}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
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

        {user.role === 'zarzad' && isBoard && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="notify_reception"
              defaultChecked
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Powiadom Recepcję o rezerwacji
          </label>
        )}

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
            * W widoku Obserwatora ta rezerwacja pojawi się jako "Blokada", bez tytułu i innych szczegółów.
          </p>
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
            {pending ? "Wysyłam…" : "Złóż wniosek"}
          </button>
          <a
            href={prefilledRoom ? `/?sala=${prefilledRoom}` : "/"}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </a>
        </div>
      </Form>
    </div>
  );
}
