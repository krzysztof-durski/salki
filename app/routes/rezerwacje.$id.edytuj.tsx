import { redirect, data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/rezerwacje.$id.edytuj";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, queryAll, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { sendEmail, tplBookingEdited } from "~/lib/email.server";
import { isAdmin } from "~/types";
import type { Booking, Room } from "~/types";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const booking = await queryOne<Booking & { requester_name: string; requester_email: string }>(
    env.DB,
    `SELECT b.*, r.name as room_name, u.name as requester_name, u.email as requester_email
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     WHERE b.id = ?`,
    [params.id]
  );
  if (!booking) throw new Response(null, { status: 404 });

  const adminUser = isAdmin(user.role);

  // Regular users: can only edit their own pending booking
  if (!adminUser) {
    if (booking.requester_id !== user.id) throw new Response(null, { status: 403 });
    if (booking.status !== 'pending') return redirect(`/rezerwacje/${booking.id}`);
  }

  const rooms = adminUser
    ? await queryAll<Room>(env.DB, "SELECT id, name, category FROM rooms WHERE is_active=1 ORDER BY sort_order")
    : null;

  return { booking, isAdminUser: adminUser, rooms };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const version = parseInt(form.get("version") as string, 10);
  const roomId = form.get("room_id") ? parseInt(form.get("room_id") as string, 10) : null;
  const date = form.get("date") as string;
  const startTime = form.get("start_time") as string;
  const endTime = form.get("end_time") as string;
  const title = (form.get("title") as string)?.trim() || null;
  const attendeeCount = form.get("attendee_count") ? parseInt(form.get("attendee_count") as string, 10) : null;
  const requesterNote = (form.get("requester_note") as string)?.trim() || null;
  const adminNote = (form.get("admin_note") as string)?.trim() || null;
  // "none" | "organiser" | "all"
  const notify = (form.get("notify") as string) ?? "none";
  const bookingId = parseInt(params.id as string, 10);
  const adminUser = isAdmin(user.role);

  const booking = await queryOne<Booking & { requester_email: string }>(
    env.DB,
    `SELECT b.*, u.email as requester_email FROM bookings b JOIN users u ON u.id=b.requester_id WHERE b.id=?`,
    [bookingId]
  );
  if (!booking) throw new Response(null, { status: 404 });

  if (!adminUser && booking.requester_id !== user.id) throw new Response(null, { status: 403 });

  if (startTime >= endTime) {
    return data({ error: "Godzina końca musi być późniejsza niż godzina początku." }, { status: 400 });
  }

  const targetRoomId = adminUser && roomId ? roomId : booking.room_id;

  // Overlap check — exclude this booking itself
  const overlap = await queryOne<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) as n FROM bookings
     WHERE room_id = ? AND date = ? AND status = 'approved' AND id != ?
       AND start_time < ? AND end_time > ?`,
    [targetRoomId, date, bookingId, endTime, startTime]
  );
  if ((overlap?.n ?? 0) > 0) {
    return data({ error: "Ta sala jest już zarezerwowana w wybranym terminie." }, { status: 409 });
  }

  if (adminUser) {
    // Admins can edit any booking; optimistic lock still applies
    const result = await execute(
      env.DB,
      `UPDATE bookings
       SET room_id=?, date=?, start_time=?, end_time=?, title=?, attendee_count=?,
           requester_note=?, admin_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=?`,
      [targetRoomId, date, startTime, endTime, title, attendeeCount,
       requesterNote, adminNote, bookingId, version]
    );
    if (!result.meta.changes) {
      return data({ error: "Konflikt — ktoś inny zmodyfikował tę rezerwację. Odśwież i spróbuj ponownie." }, { status: 409 });
    }

    // Send notification email if requested
    if (notify !== "none") {
      const room = await queryOne<{ name: string }>(env.DB, "SELECT name FROM rooms WHERE id=?", [targetRoomId]);
      const appUrl = new URL(request.url).origin;
      const tpl = tplBookingEdited({ roomName: room!.name, date, startTime, endTime, adminNote, bookingId, appUrl });

      await sendEmail(env, { to: booking.requester_email, ...tpl });
    }
  } else {
    // Regular user: only pending, own booking, no room change
    const result = await execute(
      env.DB,
      `UPDATE bookings
       SET date=?, start_time=?, end_time=?, title=?, attendee_count=?,
           requester_note=?, version=version+1, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND version=? AND status='pending' AND requester_id=?`,
      [date, startTime, endTime, title, attendeeCount, requesterNote, bookingId, version, user.id]
    );
    if (!result.meta.changes) {
      return data({
        error: "Twój wniosek został właśnie przetworzony przez administratora. Edycja nie jest możliwa.",
      }, { status: 409 });
    }
  }

  await logAction(env.DB, {
    userId: user.id,
    action: 'booking.edited',
    entityType: 'booking',
    entityId: bookingId,
    details: { date, startTime, endTime, editedByAdmin: adminUser },
  });

  return redirect(`/rezerwacje/${bookingId}`);
}

export default function EdytujRezerwacje({ loaderData, actionData }: Route.ComponentProps) {
  const { booking, isAdminUser, rooms } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdminUser ? "Edytuj rezerwację" : "Edytuj wniosek"}
        </h1>
        <Link to={`/rezerwacje/${booking.id}`} className="text-sm text-gray-500 hover:text-gray-700">Anuluj</Link>
      </div>

      <Form method="post" className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <input type="hidden" name="version" value={booking.version} />

        {/* Room picker — admin only */}
        {isAdminUser && rooms ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
            <select
              name="room_id"
              defaultValue={booking.room_id}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sala: <strong>{booking.room_name}</strong></p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł spotkania</label>
          <input name="title" type="text" defaultValue={booking.title ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input name="date" type="date" required defaultValue={booking.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od *</label>
            <input name="start_time" type="time" required defaultValue={booking.start_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do *</label>
            <input name="end_time" type="time" required defaultValue={booking.end_time} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Liczba uczestników</label>
          <input name="attendee_count" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={booking.attendee_count ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi zgłaszającego</label>
          <textarea name="requester_note" rows={2} defaultValue={booking.requester_note ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        {/* Admin-only section */}
        {isAdminUser && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notatka administratora</label>
              <textarea name="admin_note" rows={2} defaultValue={booking.admin_note ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Powiadomienia e-mail</p>
              <div className="flex flex-col gap-2">
                {[
                  { value: "none",      label: "Nie wysyłaj" },
                  { value: "organiser", label: "Wyślij do organizatora" },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700">
                    <input
                      type="radio"
                      name="notify"
                      value={opt.value}
                      defaultChecked={opt.value === "none"}
                      className="accent-blue-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {actionData?.error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="font-semibold">Nie udało się zapisać zmian</p>
            <p>{actionData.error}</p>
            <Link to={`/rezerwacje/${booking.id}`} className="text-red-800 underline mt-1 inline-block">
              Zobacz aktualny stan wniosku →
            </Link>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {pending ? "Zapisuję…" : "Zapisz zmiany"}
          </button>
        </div>
      </Form>
    </div>
  );
}
