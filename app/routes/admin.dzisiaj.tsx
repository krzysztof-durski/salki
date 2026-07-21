import type { Route } from "./+types/admin.dzisiaj";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canManageBookings } from "~/types";
import type { Room, Booking } from "~/types";
import { useNavigate } from "react-router";
import { useRef, useState, useEffect } from "react";
import { usePollingRevalidation } from "~/hooks/usePollingRevalidation";

const START_HOUR = 7;
const END_HOUR = 21;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = 48;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const rooms = await queryAll<Room>(
    env.DB,
    `SELECT id, name, size_label, category, is_active, sort_order
     FROM rooms WHERE is_active = 1 ORDER BY sort_order ASC`
  );

  const bookings = await queryAll<Booking>(
    env.DB,
    `SELECT b.*, r.name as room_name, u.name as requester_name, u.role as requester_role
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     WHERE b.date = ? AND b.status IN ('pending', 'approved', 'counter_proposed')
     ORDER BY b.start_time`,
    [today]
  );

  return { rooms, bookings, today };
}

export default function AdminDzisiaj({ loaderData }: Route.ComponentProps) {
  const { rooms, bookings, today } = loaderData;
  usePollingRevalidation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    const topPx = ((nowMinutes - START_HOUR * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
    scrollRef.current.scrollTop = Math.max(0, topPx - 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isInView = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
  const nowTop = ((nowMinutes - START_HOUR * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 flex items-center px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dzisiaj</h1>
          <p className="text-sm text-gray-500 capitalize">{formattedDate}</p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Room name header row */}
        <div className="shrink-0 flex bg-white border-b border-gray-200 shadow-sm">
          <div className="w-14 shrink-0" />
          {rooms.map(room => (
            <div
              key={room.id}
              className="flex-1 min-w-0 border-l border-gray-200 px-2 py-2.5 text-center"
            >
              <p className="text-sm font-semibold text-gray-800 truncate">{room.name}</p>
              {room.size_label && (
                <p className="text-xs text-gray-400">{room.size_label}</p>
              )}
              {room.category === 'board' && (
                <span className="inline-block text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full leading-none mt-0.5">
                  Zarząd
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto flex">
          {/* Time gutter */}
          <div className="relative w-14 shrink-0 bg-white">
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
              const totalMinutes = START_HOUR * 60 + i * SLOT_MINUTES;
              if (totalMinutes % 60 !== 0) return <div key={i} style={{ height: SLOT_HEIGHT }} />;
              return (
                <div key={i} style={{ height: SLOT_HEIGHT }} className="relative flex items-start justify-end pr-2">
                  <span className="text-xs text-gray-400 -mt-2">
                    {String(totalMinutes / 60).padStart(2, '0')}:00
                  </span>
                </div>
              );
            })}
            {/* Divider to the room grid — small per-slot segments, not one tall
                border, because a single hairline border spanning the whole
                scrollable height silently stops repainting past the
                initially-rendered viewport in some browsers (a known
                composited-scroll under-invalidation bug). */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
              <div key={`gutter-div-${i}`} className="absolute right-0 w-px bg-gray-200" style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }} />
            ))}
          </div>

          {/* Room columns */}
          {rooms.map((room, roomIndex) => {
            const roomBookings = bookings.filter(b => b.room_id === room.id);
            const notLast = roomIndex < rooms.length - 1;
            return (
              <div key={room.id} className="flex-1 min-w-0 relative">
                <div className="relative" style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}>
                  {/* Grid lines */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                      style={{ top: i * SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Right divider — small per-slot segments, see gutter note above */}
                  {notLast && Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div key={`div-${i}`} className="absolute right-0 w-px bg-gray-100" style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }} />
                  ))}

                  {/* Current time line */}
                  {isInView && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: nowTop }}
                    >
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-red-400" />
                      </div>
                    </div>
                  )}

                  {/* Booking blocks */}
                  {layoutBookings(roomBookings).map(({ booking, col, totalCols }) => (
                    <BookingBlock key={booking.id} booking={booking} col={col} totalCols={totalCols} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - START_HOUR) * 60 + m) / SLOT_MINUTES;
}

function layoutBookings(bookings: Booking[]): { booking: Booking; col: number; totalCols: number }[] {
  if (bookings.length === 0) return [];
  const sorted = [...bookings].sort((a, b) =>
    a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time)
  );
  const colEnds: string[] = [];
  const assignments = sorted.map(booking => {
    let col = colEnds.findIndex(end => end <= booking.start_time);
    if (col === -1) { col = colEnds.length; colEnds.push(booking.end_time); }
    else colEnds[col] = booking.end_time;
    return { booking, col };
  });
  return assignments.map(item => ({
    ...item,
    totalCols: assignments
      .filter(o => o.booking.start_time < item.booking.end_time && o.booking.end_time > item.booking.start_time)
      .reduce((max, o) => Math.max(max, o.col + 1), 1),
  }));
}

function getBlockColor(status: Booking['status'], requesterRole?: string): string {
  if (requesterRole === 'zarzad') {
    if (status === 'approved') return 'bg-purple-100 text-purple-900 border border-purple-400';
    if (status === 'pending') return 'bg-amber-100 text-amber-900 border border-amber-300';
    if (status === 'counter_proposed') return 'bg-orange-100 text-orange-900 border border-orange-300';
    return 'bg-gray-100 text-gray-600 border border-gray-300';
  }
  if (status === 'approved') return 'bg-sky-100 text-sky-900 border border-sky-300';
  if (status === 'pending') return 'bg-amber-100 text-amber-900 border border-amber-300';
  if (status === 'counter_proposed') return 'bg-orange-100 text-orange-900 border border-orange-300';
  return 'bg-gray-100 text-gray-600 border border-gray-300';
}

function getStatusLabel(status: Booking['status'], requesterRole?: string): string {
  if (status === 'approved') {
    if (requesterRole === 'pracownik') return 'Biuro';
    return 'Zatwierdzona';
  }
  if (status === 'pending') return 'Oczekuje';
  if (status === 'counter_proposed') return 'Kontrpropozycja';
  return 'Odrzucona';
}

function BookingBlock({ booking, col, totalCols }: { booking: Booking; col: number; totalCols: number }) {
  const navigate = useNavigate();
  const top = timeToSlot(booking.start_time) * SLOT_HEIGHT;
  const height = Math.max(
    SLOT_HEIGHT,
    (timeToSlot(booking.end_time) - timeToSlot(booking.start_time)) * SLOT_HEIGHT
  );
  const leftPct = (col / totalCols) * 100;
  const widthPct = 100 / totalCols;
  const isZarzad = booking.requester_role === 'zarzad';

  return (
    <div
      className={`absolute rounded overflow-hidden text-xs px-1.5 py-1 z-10 cursor-pointer hover:brightness-95 ${getBlockColor(booking.status, booking.requester_role)}${isZarzad && booking.status === 'pending' ? ' slot-blink' : ''}`}
      style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
      onClick={() => navigate(`/rezerwacje/${booking.id}`)}
    >
      <p className="font-semibold leading-tight truncate">{booking.title ?? booking.requester_name}</p>
      <p className="opacity-70 truncate">{booking.start_time}–{booking.end_time}</p>
      {height >= SLOT_HEIGHT * 2 && (
        <p className="opacity-60 truncate text-[10px]">{booking.requester_name}</p>
      )}
      {isZarzad && (
        <span className="absolute top-0.5 right-1 text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-1 py-0.5 rounded-full leading-none">Zarząd</span>
      )}
      <p className="absolute bottom-1 right-1.5 opacity-50 text-[10px] leading-none">
        {getStatusLabel(booking.status, booking.requester_role)}
      </p>
    </div>
  );
}
