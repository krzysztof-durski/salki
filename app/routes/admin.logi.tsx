import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/admin.logi";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll } from "~/lib/db.server";
import { canViewAuditLogs } from "~/types";
import type { AuditLog } from "~/types";

type AuditLogRow = AuditLog & { entity_name: string | null };

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canViewAuditLogs(user.role)) throw new Response(null, { status: 403 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("strona") ?? "1", 10));
  const showCleanup = url.searchParams.get("czyszczenie") === "1";
  const limit = 50;
  const offset = (page - 1) * limit;

  // The automatic data-retention cleanup job logs constantly and drowns out
  // everything else by default — hidden unless explicitly toggled on.
  const cleanupFilter = showCleanup ? "" : "WHERE al.action != 'retention.cleanup'";

  const logs = await queryAll<AuditLogRow>(
    env.DB,
    `SELECT al.*, u.name as user_name,
       COALESCE(b.title, tu.name, r.name) as entity_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id=al.user_id
     LEFT JOIN bookings b ON al.entity_type='booking' AND b.id=al.entity_id
     LEFT JOIN users tu ON al.entity_type='user' AND tu.id=al.entity_id
     LEFT JOIN rooms r ON al.entity_type='room' AND r.id=al.entity_id
     ${cleanupFilter}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const countRow = await queryAll<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) as n FROM audit_logs al ${cleanupFilter}`,
    []
  );
  const total = countRow[0]?.n ?? 0;

  return { logs, page, total, limit, showCleanup };
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
  'booking.deleted': 'Usunięto rezerwację',
  'booking.zarzad_direct_edit': 'Edycja bezpośrednia (zarząd)',
  'booking.title_changed': 'Zmieniono tytuł rezerwacji',
  'booking.note_updated': 'Zaktualizowano notatkę',
  'change_request.submitted': 'Złożono wniosek o zmianę',
  'change_request.approved': 'Zatwierdzono zmianę',
  'change_request.rejected': 'Odrzucono zmianę',
  'user.created': 'Utworzono użytkownika',
  'user.edited': 'Edytowano użytkownika',
  'user.profile_edited': 'Edytowano profil użytkownika',
  'user.toggled': 'Zmieniono status użytkownika',
  'user.deleted': 'Usunięto użytkownika',
  'user.password_reset': 'Zresetowano hasło użytkownika',
  'user.password_changed': 'Zmieniono własne hasło',
  'room.created': 'Dodano salę',
  'room.edited': 'Edytowano salę',
  'room.toggled': 'Zmieniono status sali',
  'observer_settings.updated': 'Zaktualizowano ustawienia obserwatora',
  'auth.login': 'Zalogowano',
  'auth.login_failed': 'Nieudane logowanie',
  'auth.logout': 'Wylogowano',
  'auth.observer_login': 'Zalogowano do podglądu',
  'auth.observer_login_failed': 'Nieudane logowanie do podglądu',
  'auth.observer_logout': 'Wylogowano z podglądu',
  'retention.cleanup': '♻️ Automatyczne czyszczenie danych',
  'series.created': 'Utworzono serię cykliczną',
  'series.bulk_edited': 'Zaktualizowano terminy serii',
  'series.split': 'Zmieniono regułę serii cyklicznej',
  'series.bulk_deleted': 'Usunięto terminy serii',
  'series.deleted': 'Usunięto serię cykliczną',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  booking: 'Rezerwacja',
  booking_series: 'Seria cykliczna',
  user: 'Użytkownik',
  room: 'Sala',
  change_request: 'Wniosek o zmianę',
  observer_settings: 'Ustawienia obserwatora',
  observer_session: 'Sesja podglądu',
  system: 'System',
};

function entityLabel(log: AuditLogRow): string {
  const type = ENTITY_TYPE_LABELS[log.entity_type] ?? log.entity_type;
  if (!log.entity_id) return type;
  return `${type}: ${log.entity_name ?? `#${log.entity_id}`}`;
}

export default function AdminLogi({ loaderData }: Route.ComponentProps) {
  const { logs, page, total, limit, showCleanup } = loaderData;
  const totalPages = Math.ceil(total / limit);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const navigate = useNavigate();

  function toggleCleanup(checked: boolean) {
    const params = new URLSearchParams();
    if (checked) params.set("czyszczenie", "1");
    navigate(`?${params.toString()}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Logi audytu</h1>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} wpisów łącznie</p>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCleanup}
            onChange={e => toggleCleanup(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Pokaż logi automatycznego czyszczenia danych
        </label>
      </div>

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
              <tr
                key={log.id}
                onClick={() => setSelected(log)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {log.created_at.replace('T', ' ').slice(0, 16)}
                </td>
                <td className="px-4 py-3 text-gray-700">{log.user_name ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="px-4 py-3 text-gray-500">
                  {log.entity_id ? (
                    <>
                      <span>{ENTITY_TYPE_LABELS[log.entity_type] ?? log.entity_type}</span>
                      {': '}
                      {log.entity_type === 'booking' ? (
                        <Link
                          to={`/rezerwacje/${log.entity_id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          {log.entity_name ?? `#${log.entity_id}`}
                        </Link>
                      ) : (
                        <span>{log.entity_name ?? `#${log.entity_id}`}</span>
                      )}
                    </>
                  ) : (
                    <span>{ENTITY_TYPE_LABELS[log.entity_type] ?? log.entity_type}</span>
                  )}
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
            <a
              href={`?strona=${page - 1}${showCleanup ? "&czyszczenie=1" : ""}`}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Poprzednia
            </a>
          )}
          <span className="text-gray-500">Strona {page} z {totalPages}</span>
          {page < totalPages && (
            <a
              href={`?strona=${page + 1}${showCleanup ? "&czyszczenie=1" : ""}`}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Następna →
            </a>
          )}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Szczegóły wpisu</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Zamknij"
              >
                ✕
              </button>
            </div>

            <dl className="text-sm divide-y divide-gray-100">
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">Data</dt>
                <dd className="text-gray-900">{selected.created_at.replace('T', ' ').slice(0, 19)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">Użytkownik</dt>
                <dd className="text-gray-900">{selected.user_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">Akcja</dt>
                <dd className="text-gray-900">{ACTION_LABELS[selected.action] ?? selected.action}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">Obiekt</dt>
                <dd className="text-gray-900">
                  {selected.entity_type === 'booking' && selected.entity_id ? (
                    <Link
                      to={`/rezerwacje/${selected.entity_id}`}
                      onClick={() => setSelected(null)}
                      className="text-blue-600 hover:underline"
                    >
                      {entityLabel(selected)}
                    </Link>
                  ) : (
                    entityLabel(selected)
                  )}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">Adres IP</dt>
                <dd className="text-gray-900">{selected.ip_address ?? '—'}</dd>
              </div>
            </dl>

            {selected.details && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Dodatkowe dane</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(JSON.parse(selected.details), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
