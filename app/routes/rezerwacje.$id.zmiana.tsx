import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.$id.zmiana";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { notifyAdmins } from "~/lib/notify.server";
import { canManageBookings, isAdmin } from "~/types";
import type { Booking, BookingChangeRequest } from "~/types";
import { isValidDateFormat, isValidTimeFormat, parseAttendeeCount } from "~/lib/validation.server";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const booking = await queryOne<Booking & { room_category: string }>(
    env.DB,
    `SELECT b.*, r.name as room_name, r.category as room_category FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?`,
    [params.id]
  );
  if (!booking) throw new Response(null, { status: 404 });
  if (booking.requester_id !== user.id && !isAdmin(user.role)) throw new Response(null, { status: 403 });
  if (booking.status !== 'approved') return redirect(`/rezerwacje/${booking.id}`);

  return { booking, isBoard: booking.room_category === 'board' };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const _action = form.get("_action") as string;
  const bookingId = parseInt(params.id as string, 10);

  const booking = await queryOne<Booking & { room_category: string }>(
    env.DB,
    `SELECT b.*, r.name as room_name, r.category as room_category FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?`,
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
      // Defend against a pre-existing CR row inserted before order validation
      // existed at the submission site.
      if (cr.new_start_time || cr.new_end_time) {
        const effStart = cr.new_start_time ?? booking.start_time;
        const effEnd = cr.new_end_time ?? booking.end_time;
        if (effStart >= effEnd) {
          return data({ error: "Wniosek zawiera nieprawidłowy zakres godzin i nie może zostać zatwierdzony." }, { status: 400 });
        }
      }

      // Only update non-null fields
      const updates: string[] = [];
      const vals: unknown[] = [];
      if (cr.new_date)           { updates.push("date=?");          vals.push(cr.new_date); }
      if (cr.new_start_time)     { updates.push("start_time=?");    vals.push(cr.new_start_time); }
      if (cr.new_end_time)       { updates.push("end_time=?");      vals.push(cr.new_end_time); }
      if (cr.new_title)          { updates.push("title=?");         vals.push(cr.new_title); }
      if (cr.new_attendee_count) { updates.push("attendee_count=?"); vals.push(cr.new_attendee_count); }
      if (cr.new_attendee_emails){ updates.push("attendee_emails=?"); vals.push(cr.new_attendee_emails); }
      if (cr.requester_note)     { updates.push("requester_note=?"); vals.push(cr.requester_note); }

      if (updates.length > 0) {
        // Version check AND room-conflict check folded into one atomic
        // UPDATE. COALESCE falls back to the row's current date/time when
        // the CR doesn't touch that field. `updates` only ever contains
        // fixed literal strings from the whitelist above — never user input.
        const result = await execute(
          env.DB,
          `UPDATE bookings
           SET ${updates.join(', ')}, version=version+1, updated_at=CURRENT_TIMESTAMP
           WHERE id=? AND version=? AND status='approved'
             AND NOT EXISTS (
               SELECT 1 FROM bookings b2
               WHERE b2.room_id = bookings.room_id
                 AND b2.date = COALESCE(?, bookings.date)
                 AND b2.status = 'approved'
                 AND b2.id != bookings.id
                 AND b2.start_time < COALESCE(?, bookings.end_time)
                 AND b2.end_time   > COALESCE(?, bookings.start_time)
             )`,
          [...vals, bookingId, booking.version, cr.new_date ?? null, cr.new_end_time ?? null, cr.new_start_time ?? null]
        );
        if (!result.meta.changes) {
          return data({ error: "Nie można zatwierdzić — rezerwacja została zmieniona lub termin jest już zajęty. Odśwież stronę." }, { status: 409 });
        }
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

  // ── User: edit or submit change request ───────────────────────────────
  if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
  if (booking.status !== 'approved') return data({ error: "Można zmieniać tylko zatwierdzone rezerwacje." }, { status: 400 });

  const newDate = (form.get("new_date") as string)?.trim() || null;
  const newStartTime = (form.get("new_start_time") as string)?.trim() || null;
  const newEndTime = (form.get("new_end_time") as string)?.trim() || null;
  const newTitle = (form.get("new_title") as string)?.trim() || null;
  const attendeeResult = parseAttendeeCount(form.get("new_attendee_count"));
  if (!attendeeResult.ok) {
    return data({ error: attendeeResult.error }, { status: 400 });
  }
  const newAttendeeCount = attendeeResult.value;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;
  const notifyReception = form.get("notify_reception") === "on";

  if (booking.room_category === 'board') {
    // Board rooms: apply change directly, no approval needed
    const targetDate = newDate ?? booking.date;
    const targetStart = newStartTime ?? booking.start_time;
    const targetEnd = newEndTime ?? booking.end_time;

    if (!isValidDateFormat(targetDate)) {
      return data({ error: "Nieprawidłowy format daty." }, { status: 400 });
    }
    if (!isValidTimeFormat(targetStart) || !isValidTimeFormat(targetEnd)) {
      return data({ error: "Nieprawidłowy format godziny." }, { status: 400 });
    }
    if (targetStart >= targetEnd) {
      return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
    }

    const originals: Record<string, string> = {};
    if (targetDate !== booking.date)
      originals.date = booking.date;
    if (targetStart !== booking.start_time || targetEnd !== booking.end_time)
      originals.hours = `${booking.start_time}–${booking.end_time}`;
    if ((newAttendeeCount ?? booking.attendee_count) != booking.attendee_count)
      originals.participants = booking.attendee_count != null ? String(booking.attendee_count) : '';
    if ((requesterNote ?? booking.requester_note ?? '') !== (booking.requester_note ?? ''))
      originals.note = booking.requester_note ?? '';

    // Version check AND room-conflict check folded into one atomic UPDATE.
    const result = await execute(
      env.DB,
      `UPDATE bookings
       SET date=?, start_time=?, end_time=?, title=?, attendee_count=?, requester_note=?,
           zarzad_edited_fields=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='approved' AND requester_id=?
         AND NOT EXISTS (
           SELECT 1 FROM bookings b2
           WHERE b2.room_id = bookings.room_id AND b2.date = ? AND b2.status = 'approved'
             AND b2.id != bookings.id AND b2.start_time < ? AND b2.end_time > ?
         )`,
      [targetDate, targetStart, targetEnd, newTitle ?? booking.title, newAttendeeCount ?? booking.attendee_count,
       requesterNote ?? booking.requester_note,
       Object.keys(originals).length ? JSON.stringify(originals) : null,
       bookingId, booking.version, user.id,
       targetDate, targetEnd, targetStart]
    );
    if (!result.meta.changes) {
      return data({ error: "Rezerwacja została zmieniona w międzyczasie, lub termin jest już zajęty. Odśwież stronę i spróbuj ponownie." }, { status: 409 });
    }

    await logAction(env.DB, {
      userId: user.id,
      action: 'booking.zarzad_direct_edit',
      entityType: 'booking',
      entityId: bookingId,
      details: {
        oldDate: booking.date,                              date: targetDate,
        oldStartTime: booking.start_time,                   startTime: targetStart,
        oldEndTime: booking.end_time,                       endTime: targetEnd,
        oldAttendeeCount: booking.attendee_count ?? null,   attendeeCount: newAttendeeCount ?? booking.attendee_count ?? null,
        oldRequesterNote: booking.requester_note ?? null,   requesterNote: requesterNote ?? booking.requester_note ?? null,
      },
    });

    if (user.role === 'zarzad' && notifyReception) {
      await notifyAdmins(env.DB, bookingId, 'zarzad_edited');
    }

    return redirect(`/rezerwacje/${bookingId}`);
  }

  // General rooms — detect which fields actually changed
  const hasDateChange     = newDate !== null && newDate !== booking.date;
  const hasStartChange    = newStartTime !== null && newStartTime !== booking.start_time;
  const hasEndChange      = newEndTime !== null && newEndTime !== booking.end_time;
  const hasTitleChange    = (newTitle ?? null) !== (booking.title ?? null);
  const hasAttendeeChange = newAttendeeCount !== null && newAttendeeCount !== booking.attendee_count;
  const hasNoteChange     = requesterNote !== (booking.requester_note ?? null);
  const hasCRChanges      = hasDateChange || hasStartChange || hasEndChange || hasAttendeeChange;

  if (newDate !== null && !isValidDateFormat(newDate)) {
    return data({ error: "Nieprawidłowy format daty." }, { status: 400 });
  }
  if (newStartTime !== null && !isValidTimeFormat(newStartTime)) {
    return data({ error: "Nieprawidłowy format godziny początku." }, { status: 400 });
  }
  if (newEndTime !== null && !isValidTimeFormat(newEndTime)) {
    return data({ error: "Nieprawidłowy format godziny końca." }, { status: 400 });
  }
  if (hasStartChange || hasEndChange) {
    const effStart = newStartTime ?? booking.start_time;
    const effEnd = newEndTime ?? booking.end_time;
    if (effStart >= effEnd) {
      return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
    }
  }

  if (!hasCRChanges && !hasTitleChange && !hasNoteChange) {
    return data({ error: "Podaj przynajmniej jedną zmianę." }, { status: 400 });
  }

  // Tracks version across up to 2 sequential UPDATEs below (note-only, then
  // possibly title-only) so the second doesn't spuriously conflict against
  // the version the first one already bumped.
  let currentVersion = booking.version;

  // Notes always apply directly without admin approval
  if (hasNoteChange) {
    const result = await execute(
      env.DB,
      `UPDATE bookings SET requester_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?`,
      [requesterNote, bookingId, currentVersion]
    );
    if (!result.meta.changes) {
      return data({ error: "Rezerwacja została zmieniona w międzyczasie. Odśwież stronę i spróbuj ponownie." }, { status: 409 });
    }
    currentVersion += 1;
  }

  // Build notification details
  const notifDetails: Record<string, { from: unknown; to: unknown }> = {};
  if (hasNoteChange)
    notifDetails.note = { from: booking.requester_note ?? null, to: requesterNote };
  if (hasDateChange)
    notifDetails.date = { from: booking.date, to: newDate };
  if (hasStartChange || hasEndChange)
    notifDetails.hours = {
      from: `${booking.start_time}–${booking.end_time}`,
      to:   `${newStartTime ?? booking.start_time}–${newEndTime ?? booking.end_time}`,
    };
  if (hasTitleChange)
    notifDetails.title = { from: booking.title ?? null, to: newTitle };
  if (hasAttendeeChange)
    notifDetails.attendees = { from: booking.attendee_count ?? null, to: newAttendeeCount };

  // Title-only (+ possibly note) — apply directly, no CR
  if (hasTitleChange && !hasCRChanges) {
    const result = await execute(
      env.DB,
      `UPDATE bookings SET title=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='approved' AND requester_id=?`,
      [newTitle, bookingId, currentVersion, user.id]
    );
    if (!result.meta.changes) {
      return data({ error: "Rezerwacja została zmieniona w międzyczasie. Odśwież stronę i spróbuj ponownie." }, { status: 409 });
    }
    await logAction(env.DB, {
      userId: user.id,
      action: 'booking.title_changed',
      entityType: 'booking',
      entityId: bookingId,
      details: { oldTitle: booking.title, newTitle },
    });
    if (hasNoteChange) {
      await notifyAdmins(env.DB, bookingId, 'note_changed', JSON.stringify(notifDetails));
    }
    return redirect(`/rezerwacje/${bookingId}`);
  }

  // Date / time / attendee changes go through the change request flow
  if (hasCRChanges) {
    await execute(
      env.DB,
      `INSERT INTO booking_change_requests
         (booking_id, requester_id, new_date, new_start_time, new_end_time, new_title,
          new_attendee_count, requester_note)
       VALUES (?,?,?,?,?,?,?,?)`,
      [bookingId, user.id,
       hasDateChange     ? newDate           : null,
       hasStartChange    ? newStartTime      : null,
       hasEndChange      ? newEndTime        : null,
       hasTitleChange    ? newTitle          : null,
       hasAttendeeChange ? newAttendeeCount  : null,
       null]
    );
    await logAction(env.DB, {
      userId: user.id,
      action: 'change_request.submitted',
      entityType: 'booking',
      entityId: bookingId,
    });
    await notifyAdmins(env.DB, bookingId, 'change_requested', JSON.stringify(notifDetails));
  } else {
    // Note-only change
    await logAction(env.DB, {
      userId: user.id,
      action: 'booking.note_updated',
      entityType: 'booking',
      entityId: bookingId,
    });
    await notifyAdmins(env.DB, bookingId, 'note_changed', JSON.stringify(notifDetails));
  }

  return redirect(`/rezerwacje/${bookingId}`);
}

export default function ZmianaRezerwacji({ loaderData, actionData }: Route.ComponentProps) {
  const { booking, isBoard } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isBoard ? "Zmień rezerwację" : "Wniosek o zmianę rezerwacji"}
        </h1>
        <Link to={`/rezerwacje/${booking.id}`} className="text-sm text-gray-500 hover:text-gray-700">Anuluj</Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        Aktualna rezerwacja: <strong>{booking.room_name}</strong>, {booking.date}, {booking.start_time}–{booking.end_time}
      </div>

      <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {!isBoard && (
          <p className="text-sm text-gray-500">Wypełnij tylko te pola, które chcesz zmienić.</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł</label>
          <input name="new_title" type="text" defaultValue={booking.title ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data {isBoard && "*"}</label>
          <input name="new_date" type="date" required={isBoard} defaultValue={booking.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od {isBoard && "*"}</label>
            <input name="new_start_time" type="time" required={isBoard} defaultValue={booking.start_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do {isBoard && "*"}</label>
            <input name="new_end_time" type="time" required={isBoard} defaultValue={booking.end_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Liczba uczestników</label>
          <input name="new_attendee_count" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={booking.attendee_count ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi</label>
          <textarea name="requester_note" rows={2} defaultValue={booking.requester_note ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        {isBoard && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="notify_reception"
              defaultChecked
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Powiadom Recepcję o zmianie
          </label>
        )}

        {actionData?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {pending
              ? (isBoard ? "Zapisuję…" : "Wysyłam…")
              : (isBoard ? "Zapisz zmiany" : "Złóż wniosek o zmianę")}
          </button>
        </div>
      </Form>
    </div>
  );
}
