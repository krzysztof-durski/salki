import { Link } from "react-router";
import type { Route } from "./+types/admin.panel";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canManageBookings, ROLE_LABELS } from "~/types";
import type { Booking, Room } from "~/types";

const PAGE_SIZE = 30;

type BookingRow = Booking & {
  room_name: string;
  requester_name: string;
  requester_role: string;
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageBookings(user.role)) throw new Response(null, { status: 403 });

  const url = new URL(request.url);
  const filterRoom   = url.searchParams.get("sala")   ?? "";
  const filterStatus = url.searchParams.get("status") ?? "";
  const filterFrom   = url.searchParams.get("od")     ?? "";
  const filterTo     = url.searchParams.get("do")     ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("strona") ?? "1", 10));

  const rooms = await queryAll<Room>(env.DB, "SELECT id, name FROM rooms ORDER BY sort_order");

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filterRoom)   { conditions.push("b.room_id = ?");   params.push(parseInt(filterRoom, 10)); }
  if (filterStatus) { conditions.push("b.status = ?");    params.push(filterStatus); }
  if (filterFrom)   { conditions.push("b.date >= ?");     params.push(filterFrom); }
  if (filterTo)     { conditions.push("b.date <= ?");     params.push(filterTo); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await queryAll<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) as n FROM bookings b ${where}`,
    params
  );
  const total = countRows[0]?.n ?? 0;

  const bookings = await queryAll<BookingRow>(
    env.DB,
    `SELECT b.*, r.name as room_name, u.name as requester_name, u.role as requester_role
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN users u ON u.id = b.requester_id
     ${where}
     ORDER BY b.date DESC, b.start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );

  return { bookings, rooms, total, page, filterRoom, filterStatus, filterFrom, filterTo };
}

const STATUS_LABEL: Record<string, string> = {
  pending:          'Oczekuje',
  approved:         'Zatwierdzona',
  rejected:         'Odrzucona',
  counter_proposed: 'Kontrpropozycja',
};
const STATUS_COLOR: Record<string, string> = {
  pending:          'bg-amber-100 text-amber-800',
  approved:         'bg-green-100 text-green-800',
  rejected:         'bg-gray-100 text-gray-500',
  counter_proposed: 'bg-orange-100 text-orange-800',
};

export default function AdminPanel({ loaderData }: Route.ComponentProps) {
  const { bookings, rooms, total, page, filterRoom, filterStatus, filterFrom, filterTo } = loaderData;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p: Record<string, string> = {
      sala: filterRoom, status: filterStatus, od: filterFrom, do: filterTo,
      strona: String(page),
      ...overrides,
    };
    const qs = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/admin/panel${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Wszystkie rezerwacje</h1>
        <span className="text-sm text-gray-400">{total} łącznie</span>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <select
          name="sala"
          defaultValue={filterRoom}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Wszystkie sale</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <select
          name="status"
          defaultValue={filterStatus}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Wszystkie statusy</option>
          <option value="pending">Oczekuje</option>
          <option value="approved">Zatwierdzona</option>
          <option value="rejected">Odrzucona</option>
          <option value="counter_proposed">Kontrpropozycja</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Od</label>
          <input
            type="date"
            name="od"
            defaultValue={filterFrom}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Do</label>
          <input
            type="date"
            name="do"
            defaultValue={filterTo}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          Filtruj
        </button>

        {(filterRoom || filterStatus || filterFrom || filterTo) && (
          <a
            href="/admin/panel"
            className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Wyczyść
          </a>
        )}
      </form>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sala</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Godziny</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tytuł</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Zgłaszający</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  Brak rezerwacji spełniających kryteria.
                </td>
              </tr>
            )}
            {bookings.map(b => (
              <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{b.room_name}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(b.date)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{b.start_time}–{b.end_time}</td>
                <td className="px-4 py-3 text-gray-700 max-w-48 truncate">
                  {b.title ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-gray-800">{b.requester_name}</span>
                  <span className="ml-1.5 text-xs text-gray-400">
                    {ROLE_LABELS[b.requester_role as keyof typeof ROLE_LABELS]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/rezerwacje/${b.id}`} className="inline-flex items-center gap-1.5 group">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]}`}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                    <span className="text-xs text-gray-300 group-hover:text-blue-600 transition-colors">→</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <a href={buildUrl({ strona: String(page - 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Poprzednia
            </a>
          )}
          <span className="text-gray-500">Strona {page} z {totalPages}</span>
          {page < totalPages && (
            <a href={buildUrl({ strona: String(page + 1) })} className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Następna →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
