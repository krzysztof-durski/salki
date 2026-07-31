import { useNavigate } from "react-router";
import { useRef, useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Star, Plus, CalendarPlus, Repeat } from "lucide-react";
import type { Room, Booking, User } from "~/types";
import { isAdmin } from "~/types";
import { buildGoogleCalendarUrl, downloadIcs } from "~/lib/calendar-export";
import { getWarsawNowMinutes, getWarsawToday } from "~/lib/warsaw-time";

interface Props {
  user?: User;
  rooms: Room[];
  bookings: Booking[];
  activeRoomId: number;
  weekStart: string; // YYYY-MM-DD
  readOnly?: boolean;
  basePath?: string;
}

const START_HOUR = 7;
const END_HOUR = 21;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = 48; // px per 30-min slot

const DAYS_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt'];

export default function CalendarView({ user, rooms, bookings, activeRoomId, weekStart, readOnly = false, basePath = "/" }: Props) {
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
  const [calendarMenu, setCalendarMenu] = useState<{ booking: Booking; x: number; y: number } | null>(null);

  const [nowMinutes, setNowMinutes] = useState(getWarsawNowMinutes);

  useEffect(() => {
    const tick = () => setNowMinutes(getWarsawNowMinutes());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const weekDates = getWeekDates(weekStart);
  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? rooms[0];
  const roomBookings = bookings.filter(b => b.room_id === activeRoomId);

  // Per-room "needs action" counts for the room-tab badges — admins need to
  // confirm/reject pending requests, requesters need to accept/reject a
  // counter-offer made on their own booking. Derived straight from the
  // already-loaded bookings, so it updates for free whenever the page
  // revalidates (see usePollingRevalidation) without a dedicated endpoint.
  const actionRequiredCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    if (!user) return counts;
    const admin = isAdmin(user.role);
    for (const b of bookings) {
      const needsAction = admin
        ? b.status === 'pending'
        : b.requester_id === user.id && b.status === 'counter_proposed';
      if (needsAction) counts[b.room_id] = (counts[b.room_id] ?? 0) + 1;
    }
    return counts;
  }, [bookings, user]);

  function goToWeek(offset: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset * 7);
    navigate(`${basePath}?week=${d.toISOString().split('T')[0]}&sala=${activeRoomId}`);
  }

  function switchRoom(roomId: number) {
    navigate(`${basePath}?week=${weekStart}&sala=${roomId}`);
  }

  function openNewBooking(date: string, startTime: string, endTime: string) {
    if (readOnly) return;
    navigate(`/rezerwacje/nowa?sala=${activeRoomId}&data=${date}&od=${startTime}&do=${endTime}`);
  }

  // A slot counts as past only once it has fully elapsed (its end time, not
  // its start time) — the slot "now" falls inside is still bookable, just
  // starting immediately rather than at the slot's nominal grid boundary.
  function isSlotPast(dayIndex: number, slot: number): boolean {
    const date = weekDates[dayIndex];
    const today = todayString();
    if (date !== today) return date < today;
    return (START_HOUR * 60 + (slot + 1) * SLOT_MINUTES) <= nowMinutes;
  }

  // A slot's nominal grid start time, unless that's already elapsed — in
  // which case a booking can still be made starting right now (matches the
  // server-side isPastDateTime check in validation.server.ts).
  function effectiveSlotStartTime(dayIndex: number, slot: number): string {
    const nominal = slotToTime(slot);
    if (weekDates[dayIndex] !== todayString()) return nominal;
    const slotStartMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
    if (slotStartMinutes >= nowMinutes) return nominal;
    const h = Math.floor(nowMinutes / 60);
    const m = nowMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Height (px) of the grayed-out past region at the top of a day column.
  function pastOverlayHeight(date: string): number {
    const today = todayString();
    if (date < today) return TOTAL_SLOTS * SLOT_HEIGHT;
    if (date > today) return 0;
    const elapsedSlots = Math.max(0, Math.min(TOTAL_SLOTS, (nowMinutes - START_HOUR * 60) / SLOT_MINUTES));
    return elapsedSlots * SLOT_HEIGHT;
  }

  function isRangeOccupied(dayIndex: number, loSlot: number, hiSlot: number): boolean {
    const date = weekDates[dayIndex];
    const dayBks = roomBookings.filter(b => {
      const effDate = b.status === 'counter_proposed' && b.counter_date ? b.counter_date : b.date;
      return effDate === date;
    });
    return dayBks.some(b => {
      const effStart = b.status === 'counter_proposed' && b.counter_start_time ? b.counter_start_time : b.start_time;
      const effEnd = b.status === 'counter_proposed' && b.counter_end_time ? b.counter_end_time : b.end_time;
      return timeToSlot(effStart) < hiSlot + 1 && timeToSlot(effEnd) > loSlot;
    });
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
    if (readOnly || e.button !== 0) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    if (isSlotPast(dayIndex, slot)) return;
    setHoverState(null);
    setDragState({ dayIndex, startSlot: slot, endSlot: slot, active: true });
    e.preventDefault();
  }

  // Outer div tracks drag y-position across the full width; looks up the
  // originating column's slot grid ref so the conversion stays accurate.
  function handleOuterMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !dragState?.active) return;
    const slotGrid = slotGridRefs.current[dragState.dayIndex];
    if (!slotGrid) return;
    const slot = slotFromClientY(slotGrid, e.clientY);
    setDragState(ds => ds ? { ...ds, endSlot: slot } : null);
  }

  function handleMouseUp(dayIndex: number) {
    if (readOnly) return;
    if (!dragState?.active || dragState.dayIndex !== dayIndex) {
      setDragState(null);
      return;
    }
    const { startSlot, endSlot } = dragState;
    setDragState(null);
    const lo = Math.min(startSlot, endSlot);
    const hi = Math.max(startSlot, endSlot);
    if (isSlotPast(dayIndex, lo)) return;
    if (isRangeOccupied(dayIndex, lo, hi)) return;
    const start = effectiveSlotStartTime(dayIndex, lo);
    if (lo === hi) {
      // single click — open with 1-hour default
      openNewBooking(weekDates[dayIndex], start, slotToTime(Math.min(lo + 2, TOTAL_SLOTS)));
    } else {
      openNewBooking(weekDates[dayIndex], start, slotToTime(hi + 1));
    }
  }

  // ── Hover preview ────────────────────────────────────────────────────────────

  function handleColumnMouseMove(dayIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || dragState?.active) return;
    const slot = slotFromClientY(e.currentTarget, e.clientY);
    if (isSlotPast(dayIndex, slot)) { setHoverState(null); return; }
    setHoverState({ dayIndex, slot });
  }

  const isToday = (date: string) => date === todayString();

  return (
    <div className="calendar-scope flex flex-col h-full overflow-hidden">
      {/* Room tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-200 bg-white overflow-x-auto shrink-0">
        {rooms.map(room => {
          const actionCount = actionRequiredCounts[room.id] ?? 0;
          return (
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
              {room.id === user?.preferred_room_id && (
                <Star size={12} className="fill-yellow-400 text-yellow-400" />
              )}
              {room.category === 'board' && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Zarząd</span>
              )}
              {actionCount > 0 && (
                <span
                  className="nav-blink bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.1rem] text-center leading-none"
                  title="Wymaga Twojej reakcji"
                >
                  {actionCount}
                </span>
              )}
            </button>
          );
        })}
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
            onClick={() => navigate(`${basePath}?sala=${activeRoomId}`)}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            Dzisiaj
          </button>
        </div>
        <div className="flex items-center gap-3">
          {activeRoom?.size_label && (
            <span className="text-xs text-gray-400">{activeRoom.size_label}</span>
          )}
          {!readOnly && (
            <button
              onClick={() => navigate(`/rezerwacje/nowa?sala=${activeRoomId}`)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Utwórz rezerwację
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Day header row — lives outside the scrolling area on purpose.
            position: sticky headers nested inside the scroll container used
            to clip the day columns' background/border to whatever was in the
            initial viewport once you scrolled (a Chromium layer-compositing
            bug), so the header is now a plain fixed row instead. */}
        <div className="flex shrink-0">
          <div className="w-14 shrink-0 bg-white border-r border-gray-400 h-11" />
          <div className="flex flex-1">
            {weekDates.map((date, dayIndex) => {
              const notLast = dayIndex < weekDates.length - 1;
              return (
                <div
                  key={date}
                  className={`flex-1 min-w-0 h-11 text-center py-1 border-b border-gray-100 ${notLast ? 'border-r border-gray-400' : ''} ${isToday(date) ? 'bg-blue-100/60' : 'bg-white'}`}
                >
                  <p className={`text-xs font-medium ${isToday(date) ? 'text-blue-700' : 'text-gray-500'}`}>
                    {DAYS_SHORT[dayIndex]}
                  </p>
                  <p className={`text-sm font-semibold ${isToday(date) ? 'text-blue-700' : 'text-gray-900'}`}>
                    {new Date(date + 'T12:00:00').getDate()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="flex flex-1 overflow-y-auto overflow-x-hidden select-none"
          onMouseMove={handleOuterMouseMove}
          onMouseLeave={() => { setDragState(null); setHoverState(null); }}
        >
          {/* Time gutter — inside scroll container so labels move with grid lines */}
          <div className="relative w-14 shrink-0 bg-white min-h-full">
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
              const minutes = (START_HOUR * 60) + i * SLOT_MINUTES;
              if (minutes % 60 !== 0) return <div key={i} style={{ height: SLOT_HEIGHT }} />;
              return (
                <div key={i} style={{ height: SLOT_HEIGHT }} className="relative flex items-start justify-end pr-2">
                  <span className="text-xs text-gray-400">{String(minutes / 60).padStart(2, '0')}:00</span>
                </div>
              );
            })}
            {/* Divider to the day grid — built from small per-slot segments,
                not one tall border, because a single hairline border spanning
                the whole scrollable height silently stops repainting past the
                initially-rendered viewport in some browsers (a known
                composited-scroll under-invalidation bug). Small absolutely
                positioned segments, like the grid lines below, don't trigger it. */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
              <div key={`gutter-div-${i}`} className="absolute right-0 w-px bg-gray-400" style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }} />
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1">
            {weekDates.map((date, dayIndex) => {
            const dayBookings = roomBookings.filter(b => {
              const effectiveDate = b.status === 'counter_proposed' && b.counter_date ? b.counter_date : b.date;
              return effectiveDate === date;
            });
            const isDraggingHere = dragState?.active && dragState.dayIndex === dayIndex;

            const isHoveringHere = !dragState?.active && hoverState?.dayIndex === dayIndex;
            const hoverSlot = hoverState?.slot ?? 0;
            const hoverOccupied = isHoveringHere && dayBookings.some(b =>
              hoverSlot >= timeToSlot(b.start_time) && hoverSlot < timeToSlot(b.end_time)
            );
            const showHoverPreview = isHoveringHere && !hoverOccupied;
            const previewEnd = Math.min(hoverSlot + 2, TOTAL_SLOTS);

            const notLast = dayIndex < weekDates.length - 1;

            return (
                // Slot grid — ref stored for accurate Y-to-slot conversion
                <div
                  key={date}
                  ref={el => { slotGridRefs.current[dayIndex] = el; }}
                  className={`relative flex-1 min-w-0 ${isToday(date) ? 'bg-blue-50/40' : ''}`}
                  style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}
                  onMouseDown={e => handleMouseDown(dayIndex, e)}
                  onMouseUp={() => handleMouseUp(dayIndex)}
                  onMouseMove={e => handleColumnMouseMove(dayIndex, e)}
                  onMouseLeave={() => setHoverState(null)}
                >
                  {/* Grid lines */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-gray-300' : 'border-gray-200'}`}
                      style={{ top: i * SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Right divider — small per-slot segments, see note on the
                      time gutter's divider for why not one continuous border. */}
                  {notLast && Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div key={`div-${i}`} className="absolute right-0 w-px bg-gray-400" style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }} />
                  ))}

                  {/* Past-time overlay — visually marks slots that can no longer be booked */}
                  {pastOverlayHeight(date) > 0 && (
                    <div
                      className="absolute left-0 right-0 top-0 bg-gray-200/50 pointer-events-none z-[1]"
                      style={{ height: pastOverlayHeight(date) }}
                    />
                  )}

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
                          {effectiveSlotStartTime(dayIndex, hoverSlot)}
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
                          {effectiveSlotStartTime(dayIndex, Math.min(dragState.startSlot, dragState.endSlot))}
                        </span>
                        <span className="text-[10px] text-blue-700 self-end leading-none">
                          {slotToTime(Math.min(Math.max(dragState.startSlot, dragState.endSlot) + 1, TOTAL_SLOTS))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Booking slots */}
                  {layoutBookings(dayBookings).map(({ booking, col, totalCols }) => (
                    <BookingSlot
                      key={booking.id}
                      booking={booking}
                      col={col}
                      totalCols={totalCols}
                      userId={user?.id ?? -1}
                      isAdminView={user ? isAdmin(user.role) : false}
                      readOnly={readOnly}
                      onTooltip={v => { setCalendarMenu(null); setTooltip(v); }}
                      onCalendarMenu={v => { setTooltip(null); setCalendarMenu(v); }}
                    />
                  ))}
                </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Booking tooltip */}
      {tooltip && (
        <BookingTooltip
          booking={tooltip.booking}
          userId={user?.id ?? -1}
          onClose={() => setTooltip(null)}
        />
      )}

      {/* Add-to-calendar menu */}
      {calendarMenu && (
        <AddToCalendarMenu
          booking={calendarMenu.booking}
          x={calendarMenu.x}
          y={calendarMenu.y}
          onClose={() => setCalendarMenu(null)}
        />
      )}
    </div>
  );
}

// ─── BookingSlot ─────────────────────────────────────────────────────────────

function BookingSlot({
  booking,
  col,
  totalCols,
  userId,
  isAdminView,
  readOnly,
  onTooltip,
  onCalendarMenu,
}: {
  booking: Booking;
  col: number;
  totalCols: number;
  userId: number;
  isAdminView: boolean;
  readOnly?: boolean;
  onTooltip: (v: { booking: Booking; x: number; y: number } | null) => void;
  onCalendarMenu: (v: { booking: Booking; x: number; y: number } | null) => void;
}) {
  const navigate = useNavigate();
  const isOwn = booking.requester_id === userId;
  const isCounter = booking.status === 'counter_proposed';
  const effectiveStart = isCounter && booking.counter_start_time ? booking.counter_start_time : booking.start_time;
  const effectiveEnd = isCounter && booking.counter_end_time ? booking.counter_end_time : booking.end_time;
  const top = timeToSlot(effectiveStart) * SLOT_HEIGHT;
  const height = Math.max(
    SLOT_HEIGHT,
    (timeToSlot(effectiveEnd) - timeToSlot(effectiveStart)) * SLOT_HEIGHT
  );
  const leftPct = (col / totalCols) * 100;
  const widthPct = 100 / totalCols;

  const colorClass = getSlotColor(booking.status, isOwn, booking.requester_role, isAdminView);
  const label = getSlotLabel(booking.status, isOwn, booking.requester_role, isAdminView);
  const isBooked = booking.status === 'approved';

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (readOnly || (isBooked && !isOwn && !isAdminView)) {
      onTooltip({ booking, x: e.clientX, y: e.clientY });
      return;
    }
    navigate(`/rezerwacje/${booking.id}`);
  }

  function handleAddToCalendar(e: React.MouseEvent) {
    e.stopPropagation();
    onCalendarMenu({ booking, x: e.clientX, y: e.clientY });
  }

  return (
    <div
      className={`absolute rounded overflow-hidden text-xs px-1.5 py-1 z-10 ${colorClass} ${
        readOnly || (isBooked && !isOwn && !isAdminView) ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-95'
      } ${isAdminView && booking.requester_role === 'zarzad' && booking.status === 'pending' ? 'slot-blink' : ''}`}
      style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
      onClick={handleClick}
      title={isBooked && !isOwn ? booking.title ?? 'Zarezerwowano' : undefined}
    >
      <p className="font-semibold leading-tight truncate">{booking.title ?? label}</p>
      <p className="opacity-80 truncate">{effectiveStart}–{effectiveEnd}</p>
      {isAdminView && booking.requester_role === 'zarzad' && (
        <span className="absolute top-0.5 right-1 text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-1 py-0.5 rounded-full leading-none">Zarząd</span>
      )}
      {booking.series_id != null && (
        <span title="Część serii cyklicznej" className="absolute top-0.5 left-0.5 text-gray-500/70">
          <Repeat size={10} />
        </span>
      )}
      <p className="absolute bottom-1 left-1.5 opacity-60 text-[10px] leading-none">{label}</p>
      <button
        onClick={handleAddToCalendar}
        title="Dodaj do kalendarza"
        aria-label="Dodaj do kalendarza"
        className="absolute bottom-0.5 right-0.5 z-20 p-1 rounded bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 shadow-sm leading-none"
      >
        <CalendarPlus size={15} />
      </button>
    </div>
  );
}

function getSlotColor(status: Booking['status'], isOwn: boolean, requesterRole?: string, isAdminView?: boolean): string {
  if (isAdminView && requesterRole === 'zarzad') {
    if (status === 'approved') return 'bg-purple-100 text-purple-900 border border-purple-400';
    if (status === 'pending') return 'bg-amber-200 text-amber-900 border border-amber-400';
    if (status === 'counter_proposed') return 'bg-orange-200 text-orange-900 border border-orange-400';
    return 'bg-gray-200 text-gray-600 border border-gray-400';
  }
  if (status === 'approved') {
    if (isAdminView) return 'bg-sky-100 text-sky-900 border border-sky-300';
    return isOwn ? 'bg-sky-200 text-sky-900 border border-sky-400' : 'bg-gray-200 text-gray-600 border border-gray-400';
  }
  if (status === 'pending') return 'bg-amber-200 text-amber-900 border border-amber-400';
  if (status === 'counter_proposed') return 'bg-orange-200 text-orange-900 border border-orange-400';
  return 'bg-gray-200 text-gray-600 border border-gray-400';
}

function getSlotLabel(status: Booking['status'], isOwn: boolean, requesterRole?: string, isAdminView?: boolean): string {
  if (status === 'approved') {
    if (isAdminView && requesterRole === 'pracownik') return 'Biuro';
    return isOwn ? 'Moja rezerwacja' : 'Zajęte';
  }
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

// ─── Add-to-calendar menu ──────────────────────────────────────────────────────

const CALENDAR_MENU_WIDTH = 176; // matches min-w-44
const CALENDAR_MENU_HEIGHT = 84; // approx. two menu items

function AddToCalendarMenu({
  booking,
  x,
  y,
  onClose,
}: {
  booking: Booking;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const isCounter = booking.status === 'counter_proposed';
  const event = {
    id: booking.id,
    title: booking.title,
    date: isCounter && booking.counter_date ? booking.counter_date : booking.date,
    startTime: isCounter && booking.counter_start_time ? booking.counter_start_time : booking.start_time,
    endTime: isCounter && booking.counter_end_time ? booking.counter_end_time : booking.end_time,
    location: booking.room_name,
    description: booking.requester_note,
  };

  const left = Math.min(Math.max(8, x), window.innerWidth - CALENDAR_MENU_WIDTH - 8);
  const top = Math.min(Math.max(8, y), window.innerHeight - CALENDAR_MENU_HEIGHT - 8);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white border border-gray-200 shadow-lg rounded-lg py-1 min-w-44 text-sm"
        style={{ top, left }}
        onClick={e => e.stopPropagation()}
      >
        <a
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
          onClick={onClose}
        >
          Google Calendar
        </a>
        <button
          type="button"
          onClick={() => { downloadIcs(event); onClose(); }}
          className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Apple / Outlook (.ics)
        </button>
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
  return getWarsawToday();
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
