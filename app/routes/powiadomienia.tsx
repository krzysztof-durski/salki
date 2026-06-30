import { Link, Form } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/powiadomienia";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryAll, execute } from "~/lib/db.server";
import { isAdmin } from "~/types";
import { Bell, CheckCircle, XCircle, Clock, Trash2, Calendar, Edit2, ChevronDown, ChevronUp } from "lucide-react";

interface Notification {
  id: number;
  booking_id: number;
  type: string;
  is_read: number;
  details: string | null;
  created_at: string;
  room_name: string;
  booking_date: string;
  booking_start: string;
  booking_end: string;
  booking_title: string | null;
}

interface TypeConfig {
  label: string;
  icon: typeof CheckCircle;
  iconColor: string;
  bg: string;
  border: string;
  dot: string;
  legendLabel: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  booking_approved:  { label: 'Rezerwacja zatwierdzona',        icon: CheckCircle, iconColor: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  dot: 'bg-green-500',   legendLabel: 'Zatwierdzone'      },
  change_approved:   { label: 'Wniosek o zmianę zatwierdzony',  icon: CheckCircle, iconColor: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  dot: 'bg-green-500',   legendLabel: 'Zatwierdzone'      },
  booking_rejected:  { label: 'Rezerwacja odrzucona',           icon: XCircle,     iconColor: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500',     legendLabel: 'Odrzucone'         },
  change_rejected:   { label: 'Wniosek o zmianę odrzucony',     icon: XCircle,     iconColor: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500',     legendLabel: 'Odrzucone'         },
  counter_proposed:  { label: 'Kontrpropozycja terminu',        icon: Clock,       iconColor: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', dot: 'bg-orange-500',  legendLabel: 'Kontrpropozycja'   },
  zarzad_created:    { label: 'Zarząd zarezerwował salę',       icon: Calendar,    iconColor: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', dot: 'bg-violet-500',  legendLabel: 'Zarząd'            },
  zarzad_edited:     { label: 'Zarząd zmienił rezerwację',      icon: Edit2,       iconColor: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', dot: 'bg-violet-500',  legendLabel: 'Zarząd'            },
  booking_requested: { label: 'Nowy wniosek o rezerwację',      icon: Clock,       iconColor: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500',   legendLabel: 'Nowe wnioski'      },
  change_requested:  { label: 'Wniosek o zmianę rezerwacji',    icon: Edit2,       iconColor: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500',   legendLabel: 'Nowe wnioski'      },
  note_changed:      { label: 'Zmiana uwag do rezerwacji',      icon: Edit2,       iconColor: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200',  dot: 'bg-slate-500',   legendLabel: 'Zmiany uwag'       },
};

const LEGEND_GROUPS = [
  { label: 'Zatwierdzone',     dot: 'bg-green-500',  bg: 'bg-green-50',  border: 'border-green-200',  desc: 'Rezerwacja lub zmiana zatwierdzona przez biuro' },
  { label: 'Odrzucone',        dot: 'bg-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    desc: 'Rezerwacja lub zmiana odrzucona przez biuro'    },
  { label: 'Kontrpropozycja',  dot: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', desc: 'Biuro zaproponowało inny termin'                },
  { label: 'Zarząd',           dot: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-200', desc: 'Zarząd bezpośrednio zarezerwował lub zmienił salę' },
  { label: 'Nowe wnioski',     dot: 'bg-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-200',  desc: 'Pracownik złożył wniosek o rezerwację lub zmianę' },
  { label: 'Zmiany uwag',      dot: 'bg-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  desc: 'Zmieniono uwagi do istniejącej rezerwacji'      },
];

const DETAIL_LABELS: Record<string, string> = {
  note: 'Uwagi', date: 'Data', hours: 'Godziny', title: 'Tytuł', attendees: 'Uczestnicy',
};

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "clear_one") {
    const id = Number(form.get("id"));
    await execute(env.DB, "DELETE FROM notifications WHERE id=? AND user_id=?", [id, user.id]);
  } else {
    await execute(env.DB, "DELETE FROM notifications WHERE user_id=?", [user.id]);
  }

  return { ok: true };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  // Fetch BEFORE marking read so we can preserve original is_read=0 values for the divider
  const notifications = await queryAll<Notification>(
    env.DB,
    `SELECT n.id, n.booking_id, n.type, n.is_read, n.details, n.created_at,
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

  await execute(
    env.DB,
    "UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0",
    [user.id]
  );

  return { notifications, userRole: user.role };
}

export default function Powiadomienia({ loaderData }: Route.ComponentProps) {
  const { notifications, userRole } = loaderData;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const showLegend = isAdmin(userRole);

  return (
    <div className="w-full max-w-3xl mx-auto px-8 py-8">
      <div className="flex items-center gap-3 mb-4">
        <Bell size={22} className="text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Powiadomienia</h1>
        {notifications.length > 0 && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <Trash2 size={15} />
            Wyczyść wszystkie
          </button>
        )}
      </div>

      {showLegend && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => setLegendOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium">Legenda kolorów</span>
            {legendOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {legendOpen && (
            <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LEGEND_GROUPS.map(g => (
                <div key={g.label} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${g.bg} ${g.border}`}>
                  <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${g.dot}`} />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{g.label}</p>
                    <p className="text-xs text-gray-500 leading-snug">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Wyczyścić powiadomienia?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Wszystkie powiadomienia zostaną trwale usunięte. Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Anuluj
              </button>
              <Form method="post" onSubmit={() => setConfirmOpen(false)}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Wyczyść
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Brak powiadomień</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(() => {
            const firstOldIndex = notifications.findIndex(n => n.is_read === 1);
            const showDivider = firstOldIndex > 0;

            return notifications.flatMap((n, i) => {
              const cfg: TypeConfig = TYPE_CONFIG[n.type] ?? {
                label: n.type, icon: Bell, iconColor: 'text-gray-500',
                bg: 'bg-white', border: 'border-gray-200', dot: 'bg-gray-400', legendLabel: '',
              };
              const Icon = cfg.icon;
              const label = n.booking_title
                ? `${n.booking_title} – ${n.room_name}`
                : n.room_name;

              const details = (() => {
                try { return n.details ? JSON.parse(n.details) as Record<string, { from: unknown; to: unknown }> : null; }
                catch { return null; }
              })();

              const card = (
                <li
                  key={n.id}
                  className={`flex items-start gap-4 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
                >
                  <Link
                    to={`/rezerwacje/${n.booking_id}`}
                    className="flex flex-1 min-w-0 items-start gap-4 transition-opacity hover:opacity-75"
                  >
                    <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-gray-900 ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                        {cfg.label}
                        {!n.is_read && (
                          <span className={`ml-2 inline-block w-1.5 h-1.5 rounded-full align-middle ${cfg.dot}`} />
                        )}
                      </p>
                      <p className="text-sm text-gray-600 truncate">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {n.booking_date}, {n.booking_start}–{n.booking_end}
                      </p>
                      {details && (
                        <ul className="mt-1.5 space-y-0.5">
                          {Object.entries(details).map(([key, val]) => (
                            <li key={key} className="text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{DETAIL_LABELS[key] ?? key}:</span>{' '}
                              {val.from !== null && val.from !== undefined
                                ? <><span className="line-through text-gray-400">{String(val.from)}</span>{' → '}</>
                                : null}
                              <span className="text-gray-800">{val.to !== null && val.to !== undefined ? String(val.to) : '—'}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <time className="text-xs text-gray-400 shrink-0 mt-0.5">
                      {new Date(n.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}
                    </time>
                  </Link>
                  <Form method="post" className="shrink-0 self-center ml-1">
                    <input type="hidden" name="intent" value="clear_one" />
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      title="Usuń powiadomienie"
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                  </Form>
                </li>
              );

              if (showDivider && i === firstOldIndex) {
                return [
                  (<li key="__divider__" className="flex items-center gap-3 py-1 select-none">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium px-1">Starsze</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </li>),
                  card,
                ];
              }
              return [card];
            });
          })()}
        </ul>
      )}
    </div>
  );
}
