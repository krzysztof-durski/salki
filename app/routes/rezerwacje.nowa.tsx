import { redirect, data, Form, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.nowa";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll, queryOne, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { canDirectBookBoardRoom, canDirectBookGeneralRoom } from "~/types";
import type { Room, User } from "~/types";
import { notifyAdmins } from "~/lib/notify.server";

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
  const attendeeCount = form.get("attendee_count") ? parseInt(form.get("attendee_count") as string, 10) : null;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;
  const notifyReception = form.get("notify_reception") === "on";

  if (!roomId || !date || !startTime || !endTime) {
    return data({ error: "Wypełnij wymagane pola." }, { status: 400 });
  }
  if (startTime >= endTime) {
    return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
  }

  // Block if any approved booking already occupies any part of this time slot
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

  // Determine if direct (no approval needed)
  const room = await queryOne<Room>(env.DB, "SELECT * FROM rooms WHERE id = ?", [roomId]);
  if (!room) return data({ error: "Nieznana sala." }, { status: 400 });

  const isDirect = room.category === 'board'
    ? canDirectBookBoardRoom(user.role)
    : canDirectBookGeneralRoom(user.role);

  const status = isDirect ? 'approved' : 'pending';

  const result = await execute(
    env.DB,
    `INSERT INTO bookings
       (room_id, requester_id, created_by_admin_id, title, date, start_time, end_time,
        attendee_count, status, requester_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [roomId, user.id, isDirect ? user.id : null, title, date, startTime, endTime,
     attendeeCount, status, requesterNote]
  );

  const bookingId = result.meta.last_row_id as number;

  await logAction(env.DB, {
    userId: user.id,
    action: isDirect ? 'booking.direct_created' : 'booking.requested',
    entityType: 'booking',
    entityId: bookingId,
    details: { roomId, date, startTime, endTime, status },
    ipAddress: request.headers.get('CF-Connecting-IP'),
  });

  if (user.role === 'zarzad' && isDirect && notifyReception) {
    await notifyAdmins(env.DB, bookingId, 'zarzad_created');
  }
  if (!isDirect) {
    await notifyAdmins(env.DB, bookingId, 'booking_requested');
  }

  return redirect(`/rezerwacje/${bookingId}`);
}

export default function NowaRezerwacja({ loaderData, actionData }: Route.ComponentProps) {
  const { user, rooms, prefilledRoom, prefilledDate, prefilledFrom, prefilledTo } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowa rezerwacja</h1>

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

        {user.role === 'zarzad' && (
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
            href="/"
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </a>
        </div>
      </Form>
    </div>
  );
}
