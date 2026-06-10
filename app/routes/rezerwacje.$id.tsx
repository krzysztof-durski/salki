import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.$id";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { sendEmail, tplApproved, tplRejected, tplCounterProposed } from "~/lib/email.server";
import { isAdmin, canManageBookings } from "~/types";
import type { Booking, BookingChangeRequest, User } from "~/types";
import { CheckCircle, XCircle, Clock, Edit2, RefreshCw, Trash2 } from "lucide-react";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const booking = await queryOne<Booking>(
    env.DB,
    `SELECT b.*, r.name as room_name, u.name as requester_name
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

  const changeRequests = await queryAll<BookingChangeRequest>(
    env.DB,
    `SELECT cr.*, u.name as requester_name
     FROM booking_change_requests cr
     JOIN users u ON u.id = cr.requester_id
     WHERE cr.booking_id = ?
     ORDER BY cr.created_at DESC`,
    [booking.id]
  );

  return { user, booking, changeRequests };
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

  const appUrl = new URL(request.url).origin;

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

    const room = await queryOne<{ name: string }>(env.DB, "SELECT name FROM rooms WHERE id=?", [booking.room_id]);
    const requester = await queryOne<{ email: string }>(env.DB, "SELECT email FROM users WHERE id=?", [booking.requester_id]);
    const emails: string[] = [requester!.email];
    if (booking.attendee_emails) {
      try { emails.push(...JSON.parse(booking.attendee_emails)); } catch {}
    }

    const tpl = tplApproved({ roomName: room!.name, date: booking.date, startTime: booking.start_time, endTime: booking.end_time, adminNote });
    await sendEmail(env, { to: emails, ...tpl });
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

    const room = await queryOne<{ name: string }>(env.DB, "SELECT name FROM rooms WHERE id=?", [booking.room_id]);
    const requester = await queryOne<{ email: string }>(env.DB, "SELECT email FROM users WHERE id=?", [booking.requester_id]);
    const tpl = tplRejected({ roomName: room!.name, date: booking.date, adminNote });
    await sendEmail(env, { to: requester!.email, ...tpl });
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

    const room = await queryOne<{ name: string }>(env.DB, "SELECT name FROM rooms WHERE id=?", [booking.room_id]);
    const requester = await queryOne<{ email: string }>(env.DB, "SELECT email FROM users WHERE id=?", [booking.requester_id]);
    const tpl = tplCounterProposed({
      roomName: room!.name, originalDate: booking.date,
      counterDate, counterStart, counterEnd, adminNote, bookingId, appUrl,
    });
    await sendEmail(env, { to: requester!.email, ...tpl });
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
    if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
    await logAction(env.DB, {
      userId: user.id,
      action: 'booking.deleted',
      entityType: 'booking',
      entityId: bookingId,
      details: { room_id: booking.room_id, date: booking.date, status: booking.status },
    });
    await execute(env.DB, "DELETE FROM bookings WHERE id = ?", [bookingId]);
    return redirect("/admin/panel");
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
  const { user, booking, changeRequests } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const isOwner = booking.requester_id === user.id;
  const isAdminUser = isAdmin(user.role);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rezerwacja #{booking.id}</h1>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Kalendarz</Link>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[booking.status]}`}>
        {STATUS_LABELS[booking.status]}
      </div>

      {/* Booking info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm">
        <Row label="Sala" value={booking.room_name ?? '—'} />
        <Row label="Data" value={booking.date} />
        <Row label="Godziny" value={`${booking.start_time}–${booking.end_time}`} />
        {booking.title && <Row label="Tytuł" value={booking.title} />}
        {booking.attendee_count && <Row label="Uczestnicy" value={`${booking.attendee_count} os.`} />}
        {booking.requester_note && <Row label="Uwagi" value={booking.requester_note} />}
        {isAdminUser && <Row label="Składający" value={booking.requester_name ?? '—'} />}
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
        {isAdminUser && (
          <Form
            method="post"
            onSubmit={e => { if (!window.confirm("Usunąć tę rezerwację? Operacja jest nieodwracalna.")) e.preventDefault(); }}
          >
            <input type="hidden" name="_action" value="delete" />
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
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
          <RefreshCw size={14} /> Złóż wniosek o zmianę
        </Link>
      )}

      {/* Admin action panel */}
      {isAdminUser && (booking.status === 'pending' || booking.status === 'counter_proposed') && (
        <AdminActions bookingId={booking.id} bookingVersion={booking.version} pending={pending} actionData={actionData} />
      )}

      {/* Change requests list */}
      {changeRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Wnioski o zmianę</h2>
          {changeRequests.map(cr => (
            <div key={cr.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Wniosek #{cr.id}</span>
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

function AdminActions({ bookingId, bookingVersion, pending, actionData }: {
  bookingId: number; bookingVersion: number; pending: boolean; actionData: { error?: string } | undefined;
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Akcje administratora</h3>
      <input type="hidden" name="booking_version" value={bookingVersion} />

      {/* Approve */}
      <Form method="post" className="space-y-2">
        <input type="hidden" name="_action" value="approve" />
        <textarea name="admin_note" rows={1} placeholder="Notatka (opcjonalnie)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:outline-none" />
        <button type="submit" disabled={pending} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <CheckCircle size={16} /> Zatwierdź
        </button>
      </Form>

      <hr className="border-gray-200" />

      {/* Reject */}
      <Form method="post" className="space-y-2">
        <input type="hidden" name="_action" value="reject" />
        <textarea name="admin_note" rows={1} placeholder="Powód odrzucenia (opcjonalnie)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:outline-none" />
        <button type="submit" disabled={pending} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <XCircle size={16} /> Odrzuć
        </button>
      </Form>

      <hr className="border-gray-200" />

      {/* Counter-propose */}
      <Form method="post" className="space-y-2">
        <input type="hidden" name="_action" value="counter" />
        <p className="text-sm font-medium text-gray-700">Kontrpropozycja terminu</p>
        <input type="date" name="counter_date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <input type="time" name="counter_start_time" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" />
          <input type="time" name="counter_end_time" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" />
        </div>
        <textarea name="admin_note" rows={1} placeholder="Notatka (opcjonalnie)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-400 focus:outline-none" />
        <button type="submit" disabled={pending} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Clock size={16} /> Zaproponuj inny termin
        </button>
      </Form>
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
