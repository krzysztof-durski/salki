import type { Route } from "./+types/admin.dzisiaj";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canManageBookings } from "~/types";
import type { Room, Booking } from "~/types";
import { useNavigate } from "react-router";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Repeat } from "lucide-react";
import { usePollingRevalidation } from "~/hooks/usePollingRevalidation";
import { getWarsawNowMinutes, getWarsawToday } from "~/lib/warsaw-time";

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

  const today = getWarsawToday();
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("data");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

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
    [date]
  );

  return { rooms, bookings, today, date };
}

export default function AdminDzisiaj({ loaderData }: Route.ComponentProps) {
  const { rooms, bookings, today, date } = loaderData;
  usePollingRevalidation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const slotGridRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const isToday = date === today;

  const [dragState, setDragState] = useState<{ roomId: number; startSlot: number; endSlot: number; active: boolean } | null>(null);
  const [hoverState, setHoverState] = useState<{ roomId: number; slot: number } | null>(null);

  const [nowMinutes, setNowMinutes] = useState(getWarsawNowMinutes);

  useEffect(() => {
    const tick = () => setNowMinutes(getWarsawNowMinutes());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (!isToday) return;
    const topPx = ((nowMinutes - START_HOUR * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
    scrollRef.current.scrollTop = Math.max(0, topPx - 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isInView = isToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
  const nowTop = ((nowMinutes - START_HOUR * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  function goToDate(newDate: string) {
    navigate(`/admin/dzisiaj?data=${skipWeekend(newDate)}`);
  }

  // Rooms aren't booked on weekends, so both day-by-day nav and the calendar
  // picker roll a Sat/Sun pick forward to the following Monday.
  function skipWeekend(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() + 2);
    else if (day === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  function shiftDate(offsetDays: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + offsetDays);
    if (offsetDays > 0) {
      if (d.getDay() === 6) d.setDate(d.getDate() + 2);
      else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    } else {
      if (d.getDay() === 6) d.setDate(d.getDate() - 1);
      else if (d.getDay() === 0) d.setDate(d.getDate() - 2);
    }
    navigate(`/admin/dzisiaj?data=${d.toISOString().split('T')[0]}`);
  }

  // ── Click/drag to create a booking directly from the grid ──────────────────

  function slotFromClientY(slotGrid: HTMLDivElement, clientY: number): number {
    const rect = slotGrid.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)));
  }

  function isSlotPast(slot: number): boolean {
    if (!isToday) return false;
    return (START_HOUR * 60 + (slot + 1) * SLOT_MINUTES) <= nowMinutes;
  }

  // A slot's nominal start time, unless that's already elapsed today — in
  // which case the booking can still be created starting right now.
  function effectiveSlotStartTime(slot: number): string {
    const nominal = slotToTime(slot);
    if (!isToday) return nominal;
    const slotStartMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
    if (slotStartMinutes >= nowMinutes) return nominal;
    const h = Math.floor(nowMinutes / 60);
    const m = nowMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function isRangeOccupied(roomId: number, loSlot: number, hiSlot: number): boolean {
    return bookings.some(b =>
      b.room_id === roomId &&
      timeToSlot(b.start_time) < hiSlot + 1 &&
      timeToSlot(b.end_time) > loSlot
    );
  }

  function openNewBooking(roomId: number, startTime: string, endTime: string) {
    navigate(`/rezerwacje/nowa?sala=${roomId}&data=${date}&od=${startTime}&do=${endTime}`);
  }

  function handleMouseDown(roomId: number, e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    if (isSlotPast(slot)) return;
    setHoverState(null);
    setDragState({ roomId, startSlot: slot, endSlot: slot, active: true });
    e.preventDefault();
  }

  function handleOuterMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragState?.active) return;
    const slotGrid = slotGridRefs.current[dragState.roomId];
    if (!slotGrid) return;
    const slot = slotFromClientY(slotGrid, e.clientY);
    setDragState(ds => ds ? { ...ds, endSlot: slot } : null);
  }

  function handleMouseUp(roomId: number) {
    if (!dragState?.active || dragState.roomId !== roomId) {
      setDragState(null);
      return;
    }
    const { startSlot, endSlot } = dragState;
    setDragState(null);
    const lo = Math.min(startSlot, endSlot);
    const hi = Math.max(startSlot, endSlot);
    if (isSlotPast(lo)) return;
    if (isRangeOccupied(roomId, lo, hi)) return;
    const start = effectiveSlotStartTime(lo);
    if (lo === hi) {
      openNewBooking(roomId, start, slotToTime(Math.min(lo + 2, TOTAL_SLOTS)));
    } else {
      openNewBooking(roomId, start, slotToTime(hi + 1));
    }
  }

  function handleColumnMouseMove(roomId: number, e: React.MouseEvent<HTMLDivElement>) {
    if (dragState?.active) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    if (isSlotPast(slot)) { setHoverState(null); return; }
    setHoverState({ roomId, slot });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rezerwacje</h1>
          <p className="text-sm text-gray-500 capitalize">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Poprzedni dzień"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5">
            <CalendarIcon size={14} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={e => e.target.value && goToDate(e.target.value)}
              className="text-sm text-gray-700 border-none outline-none bg-transparent"
            />
          </div>
          <button
            onClick={() => shiftDate(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Następny dzień"
          >
            <ChevronRight size={18} />
          </button>
          {!isToday && (
            <button
              onClick={() => goToDate(today)}
              className="ml-1 text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Dziś
            </button>
          )}
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
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex"
          onMouseMove={handleOuterMouseMove}
          onMouseLeave={() => { setDragState(null); setHoverState(null); }}
        >
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

            const isDraggingHere = dragState?.active && dragState.roomId === room.id;
            const isHoveringHere = !dragState?.active && hoverState?.roomId === room.id;
            const hoverSlot = hoverState?.slot ?? 0;
            const hoverOccupied = isHoveringHere && roomBookings.some(b =>
              hoverSlot >= timeToSlot(b.start_time) && hoverSlot < timeToSlot(b.end_time)
            );
            const showHoverPreview = isHoveringHere && !hoverOccupied;
            const previewEnd = Math.min(hoverSlot + 2, TOTAL_SLOTS);

            return (
              <div
                key={room.id}
                className="flex-1 min-w-0 relative"
                ref={el => { slotGridRefs.current[room.id] = el; }}
                onMouseDown={e => handleMouseDown(room.id, e)}
                onMouseUp={() => handleMouseUp(room.id)}
                onMouseMove={e => handleColumnMouseMove(room.id, e)}
                onMouseLeave={() => setHoverState(null)}
              >
                <div className="relative select-none cursor-pointer" style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}>
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

                  {/* Drag-to-create preview */}
                  {isDraggingHere && (
                    <div
                      className="absolute left-0.5 right-0.5 z-10 bg-blue-200/70 border border-blue-400 rounded pointer-events-none"
                      style={{
                        top: Math.min(dragState.startSlot, dragState.endSlot) * SLOT_HEIGHT,
                        height: (Math.abs(dragState.endSlot - dragState.startSlot) + 1) * SLOT_HEIGHT,
                      }}
                    />
                  )}

                  {/* Hover-to-create preview */}
                  {showHoverPreview && (
                    <div
                      className="absolute left-0.5 right-0.5 z-10 bg-blue-100/60 border border-blue-300 rounded pointer-events-none"
                      style={{ top: hoverSlot * SLOT_HEIGHT, height: (previewEnd - hoverSlot) * SLOT_HEIGHT }}
                    />
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

function slotToTime(slot: number): string {
  const totalMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); navigate(`/rezerwacje/${booking.id}`); }}
    >
      <p className="font-semibold leading-tight truncate">{booking.title ?? booking.requester_name}</p>
      <p className="opacity-70 truncate">{booking.start_time}–{booking.end_time}</p>
      {height >= SLOT_HEIGHT * 2 && (
        <p className="opacity-60 truncate text-[10px]">{booking.requester_name}</p>
      )}
      {isZarzad && (
        <span className="absolute top-0.5 right-1 text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-1 py-0.5 rounded-full leading-none">Zarząd</span>
      )}
      {booking.series_id != null && (
        <span title="Część serii cyklicznej" className="absolute top-0.5 left-0.5 text-gray-500/70">
          <Repeat size={10} />
        </span>
      )}
      <p className="absolute bottom-1 right-1.5 opacity-50 text-[10px] leading-none">
        {getStatusLabel(booking.status, booking.requester_role)}
      </p>
    </div>
  );
}
