import type { Route } from "./+types/admin.logi";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canViewAuditLogs } from "~/types";
import type { AuditLog } from "~/types";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canViewAuditLogs(user.role)) throw new Response(null, { status: 403 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("strona") ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const logs = await queryAll<AuditLog>(
    env.DB,
    `SELECT al.*, u.name as user_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id=al.user_id
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const countRow = await queryAll<{ n: number }>(env.DB, "SELECT COUNT(*) as n FROM audit_logs", []);
  const total = countRow[0]?.n ?? 0;

  return { logs, page, total, limit };
}

const ACTION_LABELS: Record<string, string> = {
  'booking.requested': 'Złożono wniosek',
  'booking.direct_created': 'Bezpośrednia rezerwacja',
  'booking.approved': 'Zatwierdzono rezerwację',
  'booking.rejected': 'Odrzucono rezerwację',
  'booking.counter_proposed': 'Kontrpropozycja',
  'booking.counter_accepted': 'Zaakceptowano kontrpropozycję',
  'booking.counter_rejected': 'Odrzucono kontrpropozycję',
  'booking.edited': 'Edytowano wniosek',
  'change_request.submitted': 'Złożono wniosek o zmianę',
  'change_request.approved': 'Zatwierdzono zmianę',
  'change_request.rejected': 'Odrzucono zmianę',
  'user.created': 'Utworzono użytkownika',
  'user.edited': 'Edytowano użytkownika',
  'user.toggled': 'Zmieniono status użytkownika',
  'room.created': 'Dodano salę',
  'room.edited': 'Edytowano salę',
  'room.toggled': 'Zmieniono status sali',
};

export default function AdminLogi({ loaderData }: Route.ComponentProps) {
  const { logs, page, total, limit } = loaderData;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Logi audytu</h1>
      <p className="text-sm text-gray-500">{total} wpisów łącznie</p>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Użytkownik</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Akcja</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Obiekt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {log.created_at.replace('T', ' ').slice(0, 16)}
                </td>
                <td className="px-4 py-3 text-gray-700">{log.user_name ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="px-4 py-3 text-gray-500">
                  {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}
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
            <a href={`?strona=${page - 1}`} className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Poprzednia
            </a>
          )}
          <span className="text-gray-500">Strona {page} z {totalPages}</span>
          {page < totalPages && (
            <a href={`?strona=${page + 1}`} className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
              Następna →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
