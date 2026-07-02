import { Form, redirect } from "react-router";
import type { Route } from "./+types/obserwator.kalendarz";
import { getObserverTokenFromRequest, getObserverSession, requireObserverSession } from "~/lib/auth.server";
import { queryAll, queryOne } from "~/lib/db.server";
import type { Room, Booking, BookingStatus } from "~/types";
import CalendarView from "~/components/CalendarView";

interface ObserverBookingRow {
  id: number;
  room_id: number;
  room_name: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  status: BookingStatus;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getObserverTokenFromRequest(request);
  requireObserverSession(await getObserverSession(env.DB, token));

  const settings = await queryOne<{ is_enabled: number }>(env.DB, "SELECT is_enabled FROM observer_settings WHERE id = 1");
  if (!settings?.is_enabled) throw redirect("/obserwator");

  const rooms = await queryAll<Room>(
    env.DB,
    `SELECT id, name, size_label, category, is_active, sort_order
     FROM rooms WHERE is_active = 1 AND category = 'general' ORDER BY sort_order ASC`
  );

  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const weekStart = weekParam ? new Date(weekParam) : getMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const dateFrom = toDateString(weekStart);
  const dateTo = toDateString(weekEnd);
  const roomIds = rooms.map(r => r.id);

  let bookings: Booking[] = [];
  if (roomIds.length > 0) {
    const placeholders = roomIds.map(() => '?').join(',');
    const rows = await queryAll<ObserverBookingRow>(
      env.DB,
      `SELECT b.id, b.room_id, r.name as room_name, b.date, b.start_time, b.end_time, b.title, b.status
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       WHERE b.room_id IN (${placeholders})
         AND b.date BETWEEN ? AND ?
         AND b.status = 'approved'
       ORDER BY b.date, b.start_time`,
      [...roomIds, dateFrom, dateTo]
    );
    bookings = rows.map(r => ({
      id: r.id,
      room_id: r.room_id,
      room_name: r.room_name,
      requester_id: 0,
      created_by_admin_id: null,
      title: r.title,
      date: r.date,
      start_time: r.start_time,
      end_time: r.end_time,
      attendee_count: null,
      attendee_emails: null,
      status: r.status,
      requester_note: null,
      admin_note: null,
      counter_date: null,
      counter_start_time: null,
      counter_end_time: null,
      version: 0,
      zarzad_edited_fields: null,
      created_at: '',
      updated_at: '',
    }));
  }

  const activeRoomParam = url.searchParams.get("sala");
  const activeRoomId = activeRoomParam ? parseInt(activeRoomParam, 10) : (rooms[0]?.id ?? 0);

  return {
    rooms,
    bookings,
    activeRoomId,
    weekStart: toDateString(weekStart),
  };
}

export default function ObserwatorKalendarz({ loaderData }: Route.ComponentProps) {
  const { rooms, bookings, activeRoomId, weekStart } = loaderData;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/assets/Lafrentz - sygnet RGB.svg" alt="Lafrentz" className="h-7" />
          <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">Tryb obserwatora</span>
        </div>
        <Form method="post" action="/obserwator/wyjscie">
          <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
            Zakończ podgląd
          </button>
        </Form>
      </header>
      <div className="flex-1 overflow-hidden">
        <CalendarView
          rooms={rooms}
          bookings={bookings}
          activeRoomId={activeRoomId}
          weekStart={weekStart}
          readOnly
          basePath="/obserwator/kalendarz"
        />
      </div>
    </div>
  );
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  if (day === 6) { date.setDate(date.getDate() + 2); }
  else if (day === 0) { date.setDate(date.getDate() + 1); }
  else { date.setDate(date.getDate() + (1 - day)); }
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
