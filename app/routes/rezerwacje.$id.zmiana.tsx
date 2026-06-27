import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.$id.zmiana";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { sendEmail, tplChangeRequestSubmitted } from "~/lib/email.server";
import { canManageBookings, isAdmin } from "~/types";
import type { Booking, BookingChangeRequest } from "~/types";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const booking = await queryOne<Booking>(
    env.DB,
    `SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?`,
    [params.id]
  );
  if (!booking) throw new Response(null, { status: 404 });
  if (booking.requester_id !== user.id && !isAdmin(user.role)) throw new Response(null, { status: 403 });
  if (booking.status !== 'approved') return redirect(`/rezerwacje/${booking.id}`);

  return { booking };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const _action = form.get("_action") as string;
  const bookingId = parseInt(params.id as string, 10);

  const booking = await queryOne<Booking>(
    env.DB,
    `SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?`,
    [bookingId]
  );
  if (!booking) throw new Response(null, { status: 404 });

  // ── Admin: approve/reject change request ───────────────────────────────
  if (_action === "approve_cr" || _action === "reject_cr") {
    if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });
    const crId = parseInt(form.get("cr_id") as string, 10);
    const adminNote = (form.get("admin_note") as string)?.trim() || null;

    const cr = await queryOne<BookingChangeRequest>(
      env.DB,
      "SELECT * FROM booking_change_requests WHERE id=? AND booking_id=? AND status='pending'",
      [crId, bookingId]
    );
    if (!cr) return data({ error: "Nie znaleziono wniosku o zmianę." }, { status: 404 });

    if (_action === "approve_cr") {
      // Only update non-null fields
      const updates: string[] = [];
      const vals: unknown[] = [];
      if (cr.new_date)           { updates.push("date=?");          vals.push(cr.new_date); }
      if (cr.new_start_time)     { updates.push("start_time=?");    vals.push(cr.new_start_time); }
      if (cr.new_end_time)       { updates.push("end_time=?");      vals.push(cr.new_end_time); }
      if (cr.new_title)          { updates.push("title=?");         vals.push(cr.new_title); }
      if (cr.new_attendee_count) { updates.push("attendee_count=?"); vals.push(cr.new_attendee_count); }
      if (cr.new_attendee_emails){ updates.push("attendee_emails=?"); vals.push(cr.new_attendee_emails); }

      if (updates.length > 0) {
        await execute(
          env.DB,
          `UPDATE bookings SET ${updates.join(', ')}, version=version+1, updated_at=CURRENT_TIMESTAMP
           WHERE id=? AND status='approved'`,
          [...vals, bookingId]
        );
      }

      await execute(env.DB,
        "UPDATE booking_change_requests SET status='approved', admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [adminNote, crId]
      );
      await execute(env.DB,
        "INSERT INTO notifications (user_id, booking_id, type) VALUES (?,?,'change_approved')",
        [cr.requester_id, bookingId]
      );
      await logAction(env.DB, { userId: user.id, action: 'change_request.approved', entityType: 'booking', entityId: bookingId });
    } else {
      await execute(env.DB,
        "UPDATE booking_change_requests SET status='rejected', admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [adminNote, crId]
      );
      await execute(env.DB,
        "INSERT INTO notifications (user_id, booking_id, type) VALUES (?,?,'change_rejected')",
        [cr.requester_id, bookingId]
      );
      await logAction(env.DB, { userId: user.id, action: 'change_request.rejected', entityType: 'booking', entityId: bookingId });
    }
    return redirect(`/rezerwacje/${bookingId}`);
  }

  // ── User: submit change request ────────────────────────────────────────
  if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
  if (booking.status !== 'approved') return data({ error: "Można zmieniać tylko zatwierdzone rezerwacje." }, { status: 400 });

  const newDate = (form.get("new_date") as string)?.trim() || null;
  const newStartTime = (form.get("new_start_time") as string)?.trim() || null;
  const newEndTime = (form.get("new_end_time") as string)?.trim() || null;
  const newTitle = (form.get("new_title") as string)?.trim() || null;
  const newAttendeeCount = form.get("new_attendee_count") ? parseInt(form.get("new_attendee_count") as string, 10) : null;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;

  if (!newDate && !newStartTime && !newEndTime && !newTitle) {
    return data({ error: "Podaj przynajmniej jedną zmianę." }, { status: 400 });
  }

  const result = await execute(
    env.DB,
    `INSERT INTO booking_change_requests
       (booking_id, requester_id, new_date, new_start_time, new_end_time, new_title,
        new_attendee_count, requester_note)
     VALUES (?,?,?,?,?,?,?,?)`,
    [bookingId, user.id, newDate, newStartTime, newEndTime, newTitle, newAttendeeCount, requesterNote]
  );

  await logAction(env.DB, {
    userId: user.id,
    action: 'change_request.submitted',
    entityType: 'booking',
    entityId: bookingId,
  });

  // Notify on-duty admins
  const onDutyAdmins = await queryAll<{ email: string }>(
    env.DB,
    "SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active=1 AND on_duty=1"
  );

  if (onDutyAdmins.length > 0) {
    const appUrl = new URL(request.url).origin;
    const tpl = tplChangeRequestSubmitted({ requesterName: user.name, roomName: booking.room_name!, bookingId, appUrl });
    await sendEmail(env, { to: onDutyAdmins.map(a => a.email), ...tpl });
  }

  return redirect(`/rezerwacje/${bookingId}`);
}

export default function ZmianaRezerwacji({ loaderData, actionData }: Route.ComponentProps) {
  const { booking } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wniosek o zmianę rezerwacji</h1>
        <Link to={`/rezerwacje/${booking.id}`} className="text-sm text-gray-500 hover:text-gray-700">Anuluj</Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        Aktualna rezerwacja: <strong>{booking.room_name}</strong>, {booking.date}, {booking.start_time}–{booking.end_time}
      </div>

      <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <p className="text-sm text-gray-500">Wypełnij tylko te pola, które chcesz zmienić.</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nowy tytuł</label>
          <input name="new_title" type="text" defaultValue={booking.title ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nowa data</label>
          <input name="new_date" type="date" defaultValue={booking.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nowa godzina od</label>
            <input name="new_start_time" type="time" defaultValue={booking.start_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nowa godzina do</label>
            <input name="new_end_time" type="time" defaultValue={booking.end_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nowa liczba uczestników</label>
          <input name="new_attendee_count" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={booking.attendee_count ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi</label>
          <textarea name="requester_note" rows={2} defaultValue={booking.requester_note ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        {actionData?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {pending ? "Wysyłam…" : "Złóż wniosek o zmianę"}
          </button>
        </div>
      </Form>
    </div>
  );
}
