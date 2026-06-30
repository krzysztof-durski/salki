import { redirect, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/dashboard";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canViewBoardRooms, isAdmin } from "~/types";
import type { Room, Booking } from "~/types";
import CalendarView from "~/components/CalendarView";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const rooms = await queryAll<Room>(
    env.DB,
    `SELECT id, name, size_label, category, is_active, sort_order
     FROM rooms WHERE is_active = 1 ORDER BY sort_order ASC`
  );

  const visibleRooms = canViewBoardRooms(user.role)
    ? rooms
    : rooms.filter(r => r.category === 'general');

  // Load bookings for the current week (Mon–Sun)
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const weekStart = weekParam ? new Date(weekParam) : getMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const dateFrom = toDateString(weekStart);
  const dateTo = toDateString(weekEnd);
  const roomIds = visibleRooms.map(r => r.id);

  let bookings: Booking[] = [];
  if (roomIds.length > 0) {
    const placeholders = roomIds.map(() => '?').join(',');
    let statusFilter: string;
    const statusParams: number[] = [];
    if (isAdmin(user.role)) {
      statusFilter = `status IN ('pending','approved','counter_proposed')`;
    } else {
      statusFilter = `(status = 'approved' OR (requester_id = ? AND status IN ('pending','counter_proposed')))`;
      statusParams.push(user.id);
    }

    bookings = await queryAll<Booking>(
      env.DB,
      `SELECT b.*, r.name as room_name, u.name as requester_name, u.role as requester_role
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN users u ON u.id = b.requester_id
       WHERE b.room_id IN (${placeholders})
         AND b.date BETWEEN ? AND ?
         AND ${statusFilter}
       ORDER BY b.date, b.start_time`,
      [...roomIds, dateFrom, dateTo, ...statusParams]
    );
  }

  // Determine active room tab
  const activeRoomParam = url.searchParams.get("sala");
  let activeRoomId: number;
  if (activeRoomParam) {
    activeRoomId = parseInt(activeRoomParam, 10);
  } else if (user.preferred_room_id && visibleRooms.find(r => r.id === user.preferred_room_id)) {
    activeRoomId = user.preferred_room_id;
  } else {
    activeRoomId = visibleRooms[0]?.id ?? 0;
  }

  return {
    user,
    rooms: visibleRooms,
    bookings,
    activeRoomId,
    weekStart: toDateString(weekStart),
  };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user, rooms, bookings, activeRoomId, weekStart } = loaderData;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CalendarView
        user={user}
        rooms={rooms}
        bookings={bookings}
        activeRoomId={activeRoomId}
        weekStart={weekStart}
      />
    </div>
  );
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 6=Sat
  // On weekends the work week is over — jump to next Monday
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
