import { Link } from "react-router";
import type { Route } from "./+types/powiadomienia";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll, execute } from "~/lib/db.server";
import { Bell, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";

interface Notification {
  id: number;
  booking_id: number;
  type: string;
  is_read: number;
  created_at: string;
  room_name: string;
  booking_date: string;
  booking_start: string;
  booking_end: string;
  booking_title: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  booking_approved:  { label: 'Rezerwacja zatwierdzona',        icon: CheckCircle, color: 'text-green-600' },
  booking_rejected:  { label: 'Rezerwacja odrzucona',           icon: XCircle,     color: 'text-red-600'   },
  counter_proposed:  { label: 'Kontrpropozycja terminu',        icon: Clock,       color: 'text-orange-500' },
  change_approved:   { label: 'Wniosek o zmianę zatwierdzony',  icon: CheckCircle, color: 'text-green-600' },
  change_rejected:   { label: 'Wniosek o zmianę odrzucony',     icon: XCircle,     color: 'text-red-600'   },
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  // Mark all as read
  await execute(
    env.DB,
    "UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0",
    [user.id]
  );

  const notifications = await queryAll<Notification>(
    env.DB,
    `SELECT n.id, n.booking_id, n.type, n.is_read, n.created_at,
            r.name as room_name,
            b.date as booking_date, b.start_time as booking_start,
            b.end_time as booking_end, b.title as booking_title
     FROM notifications n
     JOIN bookings b ON b.id = n.booking_id
     JOIN rooms r ON r.id = b.room_id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [user.id]
  );

  return { notifications };
}

export default function Powiadomienia({ loaderData }: Route.ComponentProps) {
  const { notifications } = loaderData;

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Bell size={22} className="text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Powiadomienia</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Brak powiadomień</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? { label: n.type, icon: Bell, color: 'text-gray-500' };
            const Icon = cfg.icon;
            const label = n.booking_title
              ? `${n.booking_title} – ${n.room_name}`
              : n.room_name;

            return (
              <li key={n.id}>
                <Link
                  to={`/rezerwacje/${n.booking_id}`}
                  className={`flex items-start gap-4 px-4 py-3 rounded-xl border transition-colors hover:bg-gray-50 ${
                    n.is_read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{cfg.label}</p>
                    <p className="text-sm text-gray-600 truncate">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n.booking_date}, {n.booking_start}–{n.booking_end}
                    </p>
                  </div>
                  <time className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {new Date(n.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
