import { Link } from "react-router";
import type { Route } from "./+types/admin.serie";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { todayWarsaw } from "~/lib/validation.server";
import { canManageBookings, RECURRENCE_TYPE_LABELS, WEEKDAY_LABELS } from "~/types";
import type { BookingSeries, Room } from "~/types";
import { Plus } from "lucide-react";

const PAGE_SIZE = 30;

type SeriesRow = BookingSeries & { room_name: string; upcoming_count: number };

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const url = new URL(request.url);
  const filterRoom   = url.searchParams.get("sala")   ?? "";
  const filterStatus = url.searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("strona") ?? "1", 10));

  const rooms = await queryAll<Room>(env.DB, "SELECT id, name FROM rooms ORDER BY sort_order");

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filterRoom)   { conditions.push("s.room_id = ?"); params.push(parseInt(filterRoom, 10)); }
  if (filterStatus) { conditions.push("s.status = ?");  params.push(filterStatus); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await queryAll<{ n: number }>(env.DB, `SELECT COUNT(*) as n FROM booking_series s ${where}`, params);
  const total = countRows[0]?.n ?? 0;

  const today = todayWarsaw();
  const series = await queryAll<SeriesRow>(
    env.DB,
    `SELECT s.*, r.name as room_name,
       (SELECT COUNT(*) FROM bookings b WHERE b.series_id = s.id AND b.date >= ?) as upcoming_count
     FROM booking_series s
     JOIN rooms r ON r.id = s.room_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [today, ...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );

  return { series, rooms, total, page, filterRoom, filterStatus };
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktywna',
  cancelled: 'Anulowana',
  superseded: 'Zastąpiona',
};
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
  superseded: 'bg-amber-100 text-amber-700',
};

function describeRule(s: BookingSeries): string {
  if (s.recurrence_type === 'weekly') return `Co tydzień, ${WEEKDAY_LABELS[s.weekday!]}`;
  if (s.recurrence_type === 'monthly_fixed_day') return `Co miesiąc, dzień ${s.month_day}`;
  return `Co miesiąc, pierwszy ${WEEKDAY_LABELS[s.weekday!]} od dnia ${s.month_day}`;
}

export default function AdminSerie({ loaderData }: Route.ComponentProps) {
  const { series, rooms, total, page, filterRoom, filterStatus } = loaderData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Serie cykliczne</h1>
        <Link
          to="/admin/serie/nowa"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nowa seria
        </Link>
      </div>

      <form method="get" className="flex gap-3 mb-4">
        <select name="sala" defaultValue={filterRoom} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Wszystkie sale</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select name="status" defaultValue={filterStatus} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Wszystkie statusy</option>
          <option value="active">Aktywna</option>
          <option value="cancelled">Anulowana</option>
          <option value="superseded">Zastąpiona</option>
        </select>
        <button type="submit" className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Filtruj</button>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Sala</th>
              <th className="text-left px-4 py-2.5">Tytuł</th>
              <th className="text-left px-4 py-2.5">Reguła</th>
              <th className="text-left px-4 py-2.5">Okres</th>
              <th className="text-left px-4 py-2.5">Nadchodzące</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {series.map(s => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link to={`/admin/serie/${s.id}`} className="text-blue-600 hover:underline font-medium">
                    {s.room_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-700">{s.title ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-700">{describeRule(s)}, {s.start_time}–{s.end_time}</td>
                <td className="px-4 py-2.5 text-gray-500">{s.series_start_date} – {s.series_end_date}</td>
                <td className="px-4 py-2.5 text-gray-700">{s.upcoming_count}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </td>
              </tr>
            ))}
            {series.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Brak serii cyklicznych.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          {Array.from({ length: totalPages }).map((_, i) => (
            <Link
              key={i}
              to={`?sala=${filterRoom}&status=${filterStatus}&strona=${i + 1}`}
              className={`px-3 py-1.5 rounded-lg ${page === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
