import { redirect, data, Form, Link, useNavigation } from "react-router";
import { useState, useRef } from "react";
import { ConfirmModal } from "~/components/ConfirmModal";
import type { Route } from "./+types/rezerwacje.$id";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { isAdmin, canManageBookings } from "~/types";
import type { Booking, BookingChangeRequest, User } from "~/types";
import { buildGoogleCalendarUrl, downloadIcs } from "~/lib/calendar-export";
import { CheckCircle, XCircle, Clock, Edit2, RefreshCw, Trash2, Calendar } from "lucide-react";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const booking = await queryOne<Booking & { room_category: string }>(
    env.DB,
    `SELECT b.*, r.name as room_name, r.category as room_category, u.name as requester_name, u.email as requester_email
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     WHERE b.id = ?`,
    [params.id]
  );
  if (!booking) throw new Response(null, { status: 404 });

  // Access control: only owner, admins, or same-room board members can view
  if (booking.requester_id !== user.id && !isAdmin(user.role)) {
    throw new Response(null, { status: 403 });
  }

  // Mark any unread notifications for this booking as read
  await execute(
    env.DB,
    "UPDATE notifications SET is_read=1 WHERE user_id=? AND booking_id=? AND is_read=0",
    [user.id, booking.id]
  );

  const changeRequests = await queryAll<BookingChangeRequest>(
    env.DB,
    `SELECT cr.*, u.name as requester_name
     FROM booking_change_requests cr
     JOIN users u ON u.id = cr.requester_id
     WHERE cr.booking_id = ?
     ORDER BY cr.created_at DESC`,
    [booking.id]
  );

  // null = not edited; string = original value before zarząd's direct edit
  const editedFields: { date: string | null; hours: string | null; participants: string | null; note: string | null } =
    { date: null, hours: null, participants: null, note: null };
  if (isAdmin(user.role) && booking.zarzad_edited_fields) {
    try {
      const orig = JSON.parse(booking.zarzad_edited_fields) as Record<string, string>;
      if ('date' in orig)         editedFields.date         = orig.date;
      if ('hours' in orig)        editedFields.hours        = orig.hours;
      if ('participants' in orig) editedFields.participants = orig.participants;
      if ('note' in orig)         editedFields.note         = orig.note;
    } catch {}
  }

  return { user, booking, changeRequests, isBoard: booking.room_category === 'board', editedFields };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const _action = form.get("_action") as string;
  const bookingId = parseInt(params.id as string, 10);

  const booking = await queryOne<Booking>(env.DB, "SELECT * FROM bookings WHERE id = ?", [bookingId]);
  if (!booking) throw new Response(null, { status: 404 });

  // ── Admin actions ──────────────────────────────────────────────────────

  if (_action === "approve") {
    if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
    const adminNote = (form.get("admin_note") as string)?.trim() || null;

    // Check for overlap with other approved bookings before approving
    const conflict = await queryOne<{ n: number }>(
      env.DB,
      `SELECT COUNT(*) as n FROM bookings
       WHERE room_id = ? AND date = ? AND status = 'approved' AND id != ?
         AND start_time < ? AND end_time > ?`,
      [booking.room_id, booking.date, bookingId, booking.end_time, booking.start_time]
    );
    if ((conflict?.n ?? 0) > 0) {
      return data({ error: "Nie można zatwierdzić — sala jest już zarezerwowana w tym terminie przez inną rezerwację." }, { status: 409 });
    }

    const result = await execute(
      env.DB,
      `UPDATE bookings SET status='approved', admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status IN ('pending','counter_proposed')`,
      [adminNote, bookingId, booking.version]
    );
    if (!result.meta.changes) return data({ error: "Konflikt — wniosek został już przetworzony." }, { status: 409 });

    await execute(env.DB,
      "INSERT INTO notifications (user_id, booking_id, type) VALUES (?,?,'booking_approved')",
      [booking.requester_id, bookingId]
    );
    await logAction(env.DB, { userId: user.id, action: 'booking.approved', entityType: 'booking', entityId: bookingId });
  }

  else if (_action === "reject") {
    if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
    const adminNote = (form.get("admin_note") as string)?.trim() || null;
    const result = await execute(
      env.DB,
      `UPDATE bookings SET status='rejected', admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=?`,
      [adminNote, bookingId, booking.version]
    );
    if (!result.meta.changes) return data({ error: "Konflikt — wniosek został już przetworzony." }, { status: 409 });

    await execute(env.DB,
      "INSERT INTO notifications (user_id, booking_id, type) VALUES (?,?,'booking_rejected')",
      [booking.requester_id, bookingId]
    );
    await logAction(env.DB, { userId: user.id, action: 'booking.rejected', entityType: 'booking', entityId: bookingId });
  }

  else if (_action === "counter") {
    if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
    const counterDate = form.get("counter_date") as string;
    const counterStart = form.get("counter_start_time") as string;
    const counterEnd = form.get("counter_end_time") as string;
    const adminNote = (form.get("admin_note") as string)?.trim() || null;
    if (!counterDate || !counterStart || !counterEnd) return data({ error: "Podaj pełny nowy termin." }, { status: 400 });

    const result = await execute(
      env.DB,
      `UPDATE bookings SET status='counter_proposed', counter_date=?, counter_start_time=?, counter_end_time=?,
        admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='pending'`,
      [counterDate, counterStart, counterEnd, adminNote, bookingId, booking.version]
    );
    if (!result.meta.changes) return data({ error: "Konflikt — wniosek został już przetworzony." }, { status: 409 });

    await execute(env.DB,
      "INSERT INTO notifications (user_id, booking_id, type) VALUES (?,?,'counter_proposed')",
      [booking.requester_id, bookingId]
    );
    await logAction(env.DB, { userId: user.id, action: 'booking.counter_proposed', entityType: 'booking', entityId: bookingId });
  }

  // ── User counter-response ──────────────────────────────────────────────

  else if (_action === "accept_counter") {
    if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });

    // Check the counter-proposed slot hasn't been taken since the counter was made
    const conflict = await queryOne<{ n: number }>(
      env.DB,
      `SELECT COUNT(*) as n FROM bookings
       WHERE room_id = ? AND date = ? AND status = 'approved' AND id != ?
         AND start_time < ? AND end_time > ?`,
      [booking.room_id, booking.counter_date, bookingId, booking.counter_end_time, booking.counter_start_time]
    );
    if ((conflict?.n ?? 0) > 0) {
      return data({ error: "Proponowany termin jest już zajęty. Skontaktuj się z administratorem." }, { status: 409 });
    }

    const result = await execute(
      env.DB,
      `UPDATE bookings SET status='approved', date=counter_date, start_time=counter_start_time, end_time=counter_end_time,
        counter_date=NULL, counter_start_time=NULL, counter_end_time=NULL, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='counter_proposed'`,
      [bookingId, booking.version]
    );
    if (!result.meta.changes) return data({ error: "Wystąpił błąd — odśwież stronę." }, { status: 409 });
    await logAction(env.DB, { userId: user.id, action: 'booking.counter_accepted', entityType: 'booking', entityId: bookingId });
  }

  else if (_action === "reject_counter") {
    if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
    const result = await execute(
      env.DB,
      `UPDATE bookings SET status='rejected', version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='counter_proposed'`,
      [bookingId, booking.version]
    );
    if (!result.meta.changes) return data({ error: "Wystąpił błąd — odśwież stronę." }, { status: 409 });
    await logAction(env.DB, { userId: user.id, action: 'booking.counter_rejected', entityType: 'booking', entityId: bookingId });
  }

  else if (_action === "delete") {
    const isOwner = booking.requester_id === user.id;
    if (!isOwner && !canManageBookings(user.role)) throw new Response(null, { status: 403 });
    await logAction(env.DB, {
      userId: user.id,
      action: 'booking.deleted',
      entityType: 'booking',
      entityId: bookingId,
      details: { room_id: booking.room_id, date: booking.date, status: booking.status },
    });
    await execute(env.DB, "DELETE FROM bookings WHERE id = ?", [bookingId]);
    return redirect(canManageBookings(user.role) ? "/admin/panel" : "/");
  }

  return redirect(`/rezerwacje/${bookingId}`);
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Oczekuje',
  approved: 'Zatwierdzona',
  rejected: 'Odrzucona',
  counter_proposed: 'Kontrpropozycja',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  counter_proposed: 'bg-orange-100 text-orange-800',
};

export default function BookingDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { user, booking, changeRequests, isBoard, editedFields } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const isOwner = booking.requester_id === user.id;
  const isAdminUser = isAdmin(user.role);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rezerwacja: {booking.title}</h1>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Kalendarz</Link>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[booking.status]}`}>
        {STATUS_LABELS[booking.status]}
      </div>

      {/* Booking info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm">
        <Row label="Sala" value={booking.room_name ?? '—'} />
        <EditableRow label="Data" value={booking.date} originalValue={isAdminUser ? editedFields.date : null} />
        <EditableRow label="Godziny" value={`${booking.start_time}–${booking.end_time}`} originalValue={isAdminUser ? editedFields.hours : null} />
        {booking.title && <Row label="Tytuł" value={booking.title} />}
        {(booking.attendee_count != null || editedFields.participants !== null) && (
          <EditableRow label="Uczestnicy" value={booking.attendee_count != null ? `${booking.attendee_count} os.` : '—'} originalValue={isAdminUser ? editedFields.participants : null} />
        )}
        {(booking.requester_note || editedFields.note !== null) && (
          <EditableRow label="Uwagi" value={booking.requester_note ?? '—'} originalValue={isAdminUser ? editedFields.note : null} />
        )}
        {isAdminUser && <Row label="Składający" value={booking.requester_name ? `${booking.requester_name} (${booking.requester_email})` : '—'} />}
        {booking.admin_note && <Row label="Notatka admina" value={booking.admin_note} />}
      </div>

      {/* Counter-proposal info */}
      {booking.status === 'counter_proposed' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-3">
          <p className="font-semibold text-orange-900">Proponowany nowy termin</p>
          <Row label="Data" value={booking.counter_date ?? '—'} />
          <Row label="Godziny" value={`${booking.counter_start_time}–${booking.counter_end_time}`} />
          {isOwner && (
            <div className="flex gap-3 pt-2">
              <Form method="post">
                <input type="hidden" name="_action" value="accept_counter" />
                <button type="submit" disabled={pending} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  <CheckCircle size={16} /> Akceptuj
                </button>
              </Form>
              <Form method="post">
                <input type="hidden" name="_action" value="reject_counter" />
                <button type="submit" disabled={pending} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  <XCircle size={16} /> Odrzuć
                </button>
              </Form>
            </div>
          )}
        </div>
      )}

      {/* Edit / delete — owner can edit own pending; admins can edit or delete any */}
      <div className="flex items-center gap-4">
        {((isOwner && booking.status === 'pending') || isAdminUser) && (
          <Link
            to={`/rezerwacje/${booking.id}/edytuj`}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Edit2 size={14} /> {isAdminUser && !isOwner ? "Edytuj rezerwację" : "Edytuj wniosek"}
          </Link>
        )}
        {(isOwner || isAdminUser) && (
          <Form method="post" ref={deleteFormRef}>
            <input type="hidden" name="_action" value="delete" />
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              onClick={() => setConfirm({
                message: "Usunąć tę rezerwację? Operacja jest nieodwracalna.",
                onConfirm: () => deleteFormRef.current?.requestSubmit(),
              })}
            >
              <Trash2 size={14} /> Usuń rezerwację
            </button>
          </Form>
        )}
      </div>
      {isOwner && booking.status === 'approved' && (
        <Link
          to={`/rezerwacje/${booking.id}/zmiana`}
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <RefreshCw size={14} /> {isBoard ? "Zmień rezerwację" : "Złóż wniosek o zmianę"}
        </Link>
      )}

      {booking.status === 'approved' && (
        <AddToCalendar booking={booking} />
      )}

      {/* Admin action panel */}
      {isAdminUser && booking.status === 'pending' && (
        <AdminActions bookingId={booking.id} bookingVersion={booking.version} pending={pending} actionData={actionData} bookingDate={booking.date} bookingStartTime={booking.start_time} bookingEndTime={booking.end_time} />
      )}

      {/* Change requests list */}
      {changeRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Wnioski o zmianę</h2>
          {changeRequests.map((cr, index) => (
            <div key={cr.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Wniosek #{changeRequests.length - index}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[cr.status]}`}>
                  {STATUS_LABELS[cr.status]}
                </span>
              </div>
              {cr.new_date && <Row label="Nowa data" value={cr.new_date} />}
              {cr.new_start_time && <Row label="Nowe godziny" value={`${cr.new_start_time}–${cr.new_end_time}`} />}
              {cr.requester_note && <Row label="Uwagi" value={cr.requester_note} />}
              {isAdminUser && cr.status === 'pending' && (
                <ChangeRequestActions crId={cr.id} bookingId={booking.id} pending={pending} />
              )}
            </div>
          ))}
        </div>
      )}

      {actionData?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {actionData.error}
        </p>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

function EditableRow({ label, value, originalValue }: { label: string; value: string; originalValue: string | null }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-gray-900">
        {value}
        {originalValue !== null && (
          <span className="ml-2 text-xs text-amber-700">
            (edytowane | oryginalnie: {originalValue || '—'})
          </span>
        )}
      </span>
    </div>
  );
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function AdminActions({ bookingId, bookingVersion, pending, actionData, bookingDate, bookingStartTime, bookingEndTime }: {
  bookingId: number; bookingVersion: number; pending: boolean; actionData: { error?: string } | undefined;
  bookingDate: string; bookingStartTime: string; bookingEndTime: string;
}) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterStartTime, setCounterStartTime] = useState("");
  const [counterEndTime, setCounterEndTime] = useState("");

  function handleStartTimeChange(value: string) {
    setCounterStartTime(value);
    if (value && bookingStartTime && bookingEndTime) {
      const duration = durationMinutes(bookingStartTime, bookingEndTime);
      setCounterEndTime(addMinutes(value, duration));
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
        <RefreshCw size={15} className="text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Akcje administratora</h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Approve + Reject side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Approve */}
          <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm font-semibold text-green-800">Zatwierdź</span>
            </div>
            <Form method="post" className="space-y-2">
              <input type="hidden" name="_action" value="approve" />
              <input type="hidden" name="booking_version" value={bookingVersion} />
              <textarea
                name="admin_note"
                rows={2}
                placeholder="Notatka (opcjonalnie)"
                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm resize-none bg-white focus:ring-2 focus:ring-green-400 focus:outline-none placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <CheckCircle size={15} /> Zatwierdź
              </button>
            </Form>
          </div>

          {/* Reject */}
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-red-600" />
              <span className="text-sm font-semibold text-red-800">Odrzuć</span>
            </div>
            <Form method="post" className="space-y-2">
              <input type="hidden" name="_action" value="reject" />
              <input type="hidden" name="booking_version" value={bookingVersion} />
              <textarea
                name="admin_note"
                rows={2}
                placeholder="Powód odrzucenia (opcjonalnie)"
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none bg-white focus:ring-2 focus:ring-red-400 focus:outline-none placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <XCircle size={15} /> Odrzuć
              </button>
            </Form>
          </div>
        </div>

        {/* Counter-propose — collapsible */}
        <div className="border border-orange-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCounter(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-orange-500" />
              <span className="text-sm font-semibold text-orange-800">Zaproponuj inny termin</span>
            </div>
            <span className="text-orange-400 text-lg leading-none">{showCounter ? '−' : '+'}</span>
          </button>

          {showCounter && (
            <Form method="post" className="px-4 pb-4 pt-3 space-y-3 bg-orange-50">
              <input type="hidden" name="_action" value="counter" />
              <input type="hidden" name="booking_version" value={bookingVersion} />
              <div className="space-y-2">
                <label className="text-xs font-medium text-orange-700 uppercase tracking-wide">Data</label>
                <input
                  type="date"
                  name="counter_date"
                  required
                  defaultValue={bookingDate}
                  className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-orange-700 uppercase tracking-wide">Godziny</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    name="counter_start_time"
                    required
                    value={counterStartTime}
                    onChange={e => handleStartTimeChange(e.target.value)}
                    className="border border-orange-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                  <input
                    type="time"
                    name="counter_end_time"
                    required
                    value={counterEndTime}
                    onChange={e => setCounterEndTime(e.target.value)}
                    className="border border-orange-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>
              <textarea
                name="admin_note"
                rows={2}
                placeholder="Notatka (opcjonalnie)"
                className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm resize-none bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Clock size={15} /> Zaproponuj inny termin
              </button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}

function AddToCalendar({ booking }: { booking: Booking & { room_name?: string } }) {
  const [open, setOpen] = useState(false);

  const event = {
    id: booking.id,
    title: booking.title,
    date: booking.date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    location: booking.room_name,
    description: booking.requester_note,
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium"
      >
        <Calendar size={14} /> Dodaj do kalendarza
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-44">
            <a
              href={buildGoogleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Google Calendar
            </a>
            <button
              type="button"
              onClick={() => { downloadIcs(event); setOpen(false); }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Apple / Outlook (.ics)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ChangeRequestActions({ crId, bookingId, pending }: { crId: number; bookingId: number; pending: boolean }) {
  return (
    <div className="flex gap-2 pt-1">
      <Form method="post" action={`/rezerwacje/${bookingId}/zmiana`}>
        <input type="hidden" name="_action" value="approve_cr" />
        <input type="hidden" name="cr_id" value={crId} />
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
          <CheckCircle size={14} /> Zatwierdź zmianę
        </button>
      </Form>
      <Form method="post" action={`/rezerwacje/${bookingId}/zmiana`}>
        <input type="hidden" name="_action" value="reject_cr" />
        <input type="hidden" name="cr_id" value={crId} />
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
          <XCircle size={14} /> Odrzuć
        </button>
      </Form>
    </div>
  );
}
