import { Link } from "react-router";
import type { Route } from "./+types/admin.rezerwacje";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canManageBookings } from "~/types";
import type { Booking, BookingChangeRequest } from "~/types";
import { usePollingRevalidation } from "~/hooks/usePollingRevalidation";
import { Clock, RefreshCw } from "lucide-react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const pendingBookings = await queryAll<Booking>(
    env.DB,
    `SELECT b.*, r.name as room_name, u.name as requester_name
     FROM bookings b
     JOIN rooms r ON r.id=b.room_id
     JOIN users u ON u.id=b.requester_id
     WHERE b.status IN ('pending','counter_proposed')
     ORDER BY b.date ASC, b.start_time ASC`
  );

  const pendingChanges = await queryAll<BookingChangeRequest & { booking_room: string; booking_date: string }>(
    env.DB,
    `SELECT cr.*, u.name as requester_name, r.name as booking_room, b.date as booking_date
     FROM booking_change_requests cr
     JOIN bookings b ON b.id=cr.booking_id
     JOIN rooms r ON r.id=b.room_id
     JOIN users u ON u.id=cr.requester_id
     WHERE cr.status='pending'
     ORDER BY cr.created_at ASC`
  );

  return { pendingBookings, pendingChanges };
}

const STATUS_LABELS: Record<string, string> = { pending: 'Oczekuje', counter_proposed: 'Kontrpropozycja' };
const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', counter_proposed: 'bg-orange-100 text-orange-800' };

export default function AdminRezerwacje({ loaderData }: Route.ComponentProps) {
  const { pendingBookings, pendingChanges } = loaderData;
  usePollingRevalidation();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Wnioski do rozpatrzenia</h1>

      {/* Pending bookings */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Clock size={18} />
          Wnioski o rezerwację ({pendingBookings.length})
        </h2>
        {pendingBookings.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Brak oczekujących wniosków.</p>
        ) : (
          <div className="space-y-2">
            {pendingBookings.map(b => (
              <Link
                key={b.id}
                to={`/rezerwacje/${b.id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="font-medium text-gray-900">{b.room_name}</p>
                  <p className="text-sm text-gray-500">{b.date}, {b.start_time}–{b.end_time} · {b.requester_name}</p>
                  {b.title && <p className="text-xs text-gray-400 mt-0.5">{b.title}</p>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pending change requests */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <RefreshCw size={18} />
          Wnioski o zmianę rezerwacji ({pendingChanges.length})
        </h2>
        {pendingChanges.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Brak wniosków o zmianę.</p>
        ) : (
          <div className="space-y-2">
            {pendingChanges.map(cr => (
              <Link
                key={cr.id}
                to={`/rezerwacje/${cr.booking_id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="font-medium text-gray-900">{cr.booking_room}</p>
                  <p className="text-sm text-gray-500">{cr.booking_date} · {cr.requester_name}</p>
                  {cr.requester_note && <p className="text-xs text-gray-400 mt-0.5">{cr.requester_note}</p>}
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-800">
                  Zmiana
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
