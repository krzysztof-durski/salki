import { useNavigate } from "react-router";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Star, Plus } from "lucide-react";
import type { Room, Booking, User } from "~/types";
import { isAdmin } from "~/types";

interface Props {
  user: User;
  rooms: Room[];
  bookings: Booking[];
  activeRoomId: number;
  weekStart: string; // YYYY-MM-DD
}

const START_HOUR = 7;
const END_HOUR = 21;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = 48; // px per 30-min slot

const DAYS_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt'];

export default function CalendarView({ user, rooms, bookings, activeRoomId, weekStart }: Props) {
  const navigate = useNavigate();

  // Refs to each day's slot grid div — used for accurate Y→slot conversion
  // regardless of scroll position or sticky header height.
  const slotGridRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [dragState, setDragState] = useState<{
    dayIndex: number;
    startSlot: number;
    endSlot: number;
    active: boolean;
  } | null>(null);

  const [hoverState, setHoverState] = useState<{
    dayIndex: number;
    slot: number;
  } | null>(null);

  const [tooltip, setTooltip] = useState<{ booking: Booking; x: number; y: number } | null>(null);

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

  const weekDates = getWeekDates(weekStart);
  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? rooms[0];
  const roomBookings = bookings.filter(b => b.room_id === activeRoomId);

  function goToWeek(offset: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset * 7);
    navigate(`/?week=${d.toISOString().split('T')[0]}&sala=${activeRoomId}`);
  }

  function switchRoom(roomId: number) {
    navigate(`/?week=${weekStart}&sala=${roomId}`);
  }

  function openNewBooking(date: string, startTime: string, endTime: string) {
    navigate(`/rezerwacje/nowa?sala=${activeRoomId}&data=${date}&od=${startTime}&do=${endTime}`);
  }

  // ── Slot math ────────────────────────────────────────────────────────────────

  // clientY → slot index, measured relative to the slot grid element itself.
  // Using the slot grid's own getBoundingClientRect avoids the sticky-header offset.
  function slotFromClientY(slotGrid: HTMLDivElement, clientY: number): number {
    const rect = slotGrid.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)));
  }

  // ── Drag to select ───────────────────────────────────────────────────────────

  function handleMouseDown(dayIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    setHoverState(null);
    setDragState({ dayIndex, startSlot: slot, endSlot: slot, active: true });
    e.preventDefault();
  }

  // Outer div tracks drag y-position across the full width; looks up the
  // originating column's slot grid ref so the conversion stays accurate.
  function handleOuterMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragState?.active) return;
    const slotGrid = slotGridRefs.current[dragState.dayIndex];
    if (!slotGrid) return;
    const slot = slotFromClientY(slotGrid, e.clientY);
    setDragState(ds => ds ? { ...ds, endSlot: slot } : null);
  }

  function handleMouseUp(dayIndex: number) {
    if (!dragState?.active || dragState.dayIndex !== dayIndex) {
      setDragState(null);
      return;
    }
    const { startSlot, endSlot } = dragState;
    setDragState(null);
    const lo = Math.min(startSlot, endSlot);
    const hi = Math.max(startSlot, endSlot);
    openNewBooking(weekDates[dayIndex], slotToTime(lo), slotToTime(hi + 1));
  }

  function handleDayClick(dayIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    if (dragState) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    const date = weekDates[dayIndex];
    openNewBooking(date, slotToTime(slot), slotToTime(Math.min(slot + 2, TOTAL_SLOTS)));
  }

  // ── Hover preview ────────────────────────────────────────────────────────────

  function handleColumnMouseMove(dayIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    if (dragState?.active) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    setHoverState({ dayIndex, slot });
  }

  const isToday = (date: string) => date === todayString();

  return (
    <div className="calendar-scope flex flex-col h-full overflow-hidden">
      {/* Room tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-200 bg-white overflow-x-auto shrink-0">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => switchRoom(room.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              room.id === activeRoomId
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {room.name}
            {room.id === user.preferred_room_id && (
              <Star size={12} className="fill-yellow-400 text-yellow-400" />
            )}
            {room.category === 'board' && (
              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Zarząd</span>
            )}
          </button>
        ))}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => goToWeek(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {formatWeekRange(weekStart)}
          </span>
          <button onClick={() => goToWeek(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => navigate(`/?sala=${activeRoomId}`)}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            Dzisiaj
          </button>
        </div>
        <div className="flex items-center gap-3">
          {activeRoom?.size_label && (
            <span className="text-xs text-gray-400">{activeRoom.size_label}</span>
          )}
          <button
            onClick={() => navigate(`/rezerwacje/nowa?sala=${activeRoomId}`)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={15} />
            Utwórz rezerwację
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Time gutter */}
        <div className="w-14 shrink-0 bg-white border-r border-gray-200 pt-8 overflow-hidden">
          {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
            const minutes = (START_HOUR * 60) + i * SLOT_MINUTES;
            if (minutes % 60 !== 0) return <div key={i} style={{ height: SLOT_HEIGHT }} />;
            return (
              <div key={i} style={{ height: SLOT_HEIGHT }} className="relative flex items-start justify-end pr-2">
                <span className="text-xs text-gray-400 -mt-2">{String(minutes / 60).padStart(2, '0')}:00</span>
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        <div
          className="flex flex-1 overflow-y-auto overflow-x-hidden select-none"
          onMouseMove={handleOuterMouseMove}
          onMouseLeave={() => { setDragState(null); setHoverState(null); }}
        >
          {weekDates.map((date, dayIndex) => {
            const dayBookings = roomBookings.filter(b => b.date === date);
            const isDraggingHere = dragState?.active && dragState.dayIndex === dayIndex;

            const isHoveringHere = !dragState?.active && hoverState?.dayIndex === dayIndex;
            const hoverSlot = hoverState?.slot ?? 0;
            const hoverOccupied = isHoveringHere && dayBookings.some(b =>
              hoverSlot >= timeToSlot(b.start_time) && hoverSlot < timeToSlot(b.end_time)
            );
            const showHoverPreview = isHoveringHere && !hoverOccupied;
            const previewEnd = Math.min(hoverSlot + 2, TOTAL_SLOTS);

            return (
              <div
                key={date}
                className={`flex-1 min-w-0 border-r border-gray-100 last:border-r-0 relative ${isToday(date) ? 'bg-blue-50/40' : ''}`}
              >
                {/* Day header */}
                <div className={`sticky top-0 z-10 text-center py-1 border-b border-gray-100 ${isToday(date) ? 'bg-blue-100/60' : 'bg-white'}`}>
                  <p className={`text-xs font-medium ${isToday(date) ? 'text-blue-700' : 'text-gray-500'}`}>
                    {DAYS_SHORT[dayIndex]}
                  </p>
                  <p className={`text-sm font-semibold ${isToday(date) ? 'text-blue-700' : 'text-gray-900'}`}>
                    {new Date(date + 'T12:00:00').getDate()}
                  </p>
                </div>

                {/* Slot grid — ref stored for accurate Y-to-slot conversion */}
                <div
                  ref={el => { slotGridRefs.current[dayIndex] = el; }}
                  className="relative"
                  style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}
                  onMouseDown={e => handleMouseDown(dayIndex, e)}
                  onMouseUp={() => handleMouseUp(dayIndex)}
                  onMouseMove={e => handleColumnMouseMove(dayIndex, e)}
                  onMouseLeave={() => setHoverState(null)}
                  onClick={e => handleDayClick(dayIndex, e)}
                >
                  {/* Grid lines */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                      style={{ top: i * SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Current time line — only on today's column */}
                  {isToday(date) && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: ((nowMinutes - START_HOUR * 60) / SLOT_MINUTES) * SLOT_HEIGHT }}
                    >
                      <div className="relative flex items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-blue-500" />
                      </div>
                    </div>
                  )}

                  {/* Hover preview */}
                  {showHoverPreview && hoverState && (
                    <div
                      className="absolute left-1 right-1 pointer-events-none z-[5]"
                      style={{
                        top: hoverSlot * SLOT_HEIGHT,
                        height: (previewEnd - hoverSlot) * SLOT_HEIGHT,
                        transition: 'top 60ms ease-out',
                      }}
                    >
                      <div className="h-full rounded-md bg-blue-50 border-2 border-blue-300 border-dashed flex flex-col justify-between px-1.5 py-1 overflow-hidden">
                        <span className="text-[11px] font-semibold text-blue-600 leading-none">
                          {slotToTime(hoverSlot)}
                        </span>
                        <span className="text-[10px] text-blue-400 self-end leading-none">
                          {slotToTime(previewEnd)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Drag selection preview */}
                  {isDraggingHere && dragState && (
                    <div
                      className="absolute left-1 right-1 pointer-events-none z-[5]"
                      style={{
                        top: Math.min(dragState.startSlot, dragState.endSlot) * SLOT_HEIGHT,
                        height: (Math.abs(dragState.endSlot - dragState.startSlot) + 1) * SLOT_HEIGHT,
                      }}
                    >
                      <div className="h-full rounded-md bg-blue-200 border-2 border-blue-500 flex flex-col justify-between px-1.5 py-1 overflow-hidden">
                        <span className="text-[11px] font-semibold text-blue-800 leading-none">
                          {slotToTime(Math.min(dragState.startSlot, dragState.endSlot))}
                        </span>
                        <span className="text-[10px] text-blue-700 self-end leading-none">
                          {slotToTime(Math.min(Math.max(dragState.startSlot, dragState.endSlot) + 1, TOTAL_SLOTS))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Booking slots */}
                  {dayBookings.map(booking => (
                    <BookingSlot
                      key={booking.id}
                      booking={booking}
                      userId={user.id}
                      isAdminView={isAdmin(user.role)}
                      onTooltip={setTooltip}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking tooltip */}
      {tooltip && (
        <BookingTooltip
          booking={tooltip.booking}
          userId={user.id}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  );
}

// ─── BookingSlot ─────────────────────────────────────────────────────────────

function BookingSlot({
  booking,
  userId,
  isAdminView,
  onTooltip,
}: {
  booking: Booking;
  userId: number;
  isAdminView: boolean;
  onTooltip: (v: { booking: Booking; x: number; y: number } | null) => void;
}) {
  const navigate = useNavigate();
  const isOwn = booking.requester_id === userId;
  const top = timeToSlot(booking.start_time) * SLOT_HEIGHT;
  const height = Math.max(
    SLOT_HEIGHT,
    (timeToSlot(booking.end_time) - timeToSlot(booking.start_time)) * SLOT_HEIGHT
  );

  const colorClass = getSlotColor(booking.status, isOwn);
  const label = getSlotLabel(booking.status, isOwn);
  const isBooked = booking.status === 'approved';

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isBooked && !isOwn && !isAdminView) {
      onTooltip({ booking, x: e.clientX, y: e.clientY });
      return;
    }
    navigate(`/rezerwacje/${booking.id}`);
  }

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded overflow-hidden text-xs px-1.5 py-1 z-10 ${colorClass} ${
        isBooked && !isOwn && !isAdminView ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-95'
      }`}
      style={{ top, height }}
      onClick={handleClick}
      title={isBooked && !isOwn ? booking.title ?? 'Zarezerwowano' : undefined}
    >
      <p className="font-semibold leading-tight truncate">{label}</p>
      <p className="opacity-80 truncate">{booking.start_time}–{booking.end_time}</p>
      {booking.title && (
        <p className="opacity-70 truncate">{booking.title}</p>
      )}
    </div>
  );
}

function getSlotColor(status: Booking['status'], isOwn: boolean): string {
  if (status === 'approved') {
    return isOwn ? 'bg-sky-200 text-sky-900 border border-sky-400' : 'bg-gray-200 text-gray-600 border border-gray-400';
  }
  if (status === 'pending') return 'bg-amber-200 text-amber-900 border border-amber-400';
  if (status === 'counter_proposed') return 'bg-orange-200 text-orange-900 border border-orange-400';
  return 'bg-gray-200 text-gray-600 border border-gray-400';
}

function getSlotLabel(status: Booking['status'], isOwn: boolean): string {
  if (status === 'approved') return isOwn ? 'Moja rezerwacja' : 'Zajęte';
  if (status === 'pending') return 'Oczekuje';
  if (status === 'counter_proposed') return 'Kontrpropozycja';
  return 'Odrzucono';
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function BookingTooltip({
  booking,
  onClose,
}: {
  booking: Booking;
  userId: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm w-52"
        style={{ top: 100, left: '50%', transform: 'translateX(-50%)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="font-semibold text-gray-900">{booking.title ?? 'Zarezerwowano'}</p>
        <p className="text-gray-500 text-xs mt-1">{booking.date}, {booking.start_time}–{booking.end_time}</p>
        <button onClick={onClose} className="mt-2 text-xs text-gray-400 hover:text-gray-600">Zamknij</button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const d = new Date(weekStart + 'T12:00:00');
  for (let i = 0; i < 5; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function slotToTime(slot: number): string {
  const totalMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - START_HOUR) * 60 + m) / SLOT_MINUTES;
}

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00');
  const end = new Date(weekStart + 'T12:00:00');
  end.setDate(end.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  const startStr = start.toLocaleDateString('pl-PL', opts);
  const endStr = end.toLocaleDateString('pl-PL', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}
