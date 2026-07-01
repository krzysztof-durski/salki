import { Outlet, Link, Form, useLocation, NavLink, redirect } from "react-router";
import type { Route } from "./+types/_app";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne } from "~/lib/db.server";
import { canManageBookings, canManageUsers, canViewAuditLogs, canManageRooms } from "~/types";
import {
  CalendarDays, Settings, LogOut, Users, DoorOpen, ScrollText, ClipboardList, Menu, X, Bell, CalendarRange, CalendarCheck
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

function playChime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  } catch {
    // AudioContext blocked or unavailable
  }
}

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  if (user.must_change_password) {
    const url = new URL(request.url);
    if (url.pathname !== "/ustawienia") {
      throw redirect("/ustawienia?zmien-haslo=1");
    }
  }

  let pendingCount = 0;
  if (canManageBookings(user.role)) {
    const row = await queryOne<{ n: number }>(
      env.DB,
      "SELECT COUNT(*) AS n FROM bookings WHERE status IN ('pending','counter_proposed')"
    );
    pendingCount = row?.n ?? 0;
  }

  const notifRow = await queryOne<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0",
    [user.id]
  );
  const notifCount = notifRow?.n ?? 0;

  return { user, pendingCount, notifCount };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error('[_app loader]', String(err), err instanceof Error ? err.stack : '');
    throw new Error(String(err));
  }
}

export default function AppShell({ loaderData }: Route.ComponentProps) {
  const { user, pendingCount, notifCount } = loaderData;
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [livePendingCount, setLivePendingCount] = useState(pendingCount);
  const [liveNotifCount, setLiveNotifCount] = useState(notifCount);
  const knownPendingRef = useRef(pendingCount);
  const knownNotifRef = useRef(notifCount);

  useEffect(() => {
    if (!canManageBookings(user.role)) return;

    async function poll() {
      try {
        const res = await fetch('/api/pending-count');
        const { count } = await res.json() as { count: number };
        if (count > knownPendingRef.current) playChime();
        knownPendingRef.current = count;
        setLivePendingCount(count);
      } catch { /* ignore */ }
    }

    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, [user.role]);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/notifications');
        const { count } = await res.json() as { count: number };
        if (count > knownNotifRef.current) playChime();
        knownNotifRef.current = count;
        setLiveNotifCount(count);
      } catch { /* ignore */ }
    }

    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, []);

  // Re-fetch notif count after navigating to a page that marks notifications read
  useEffect(() => {
    const shouldRefetch =
      location.pathname === '/powiadomienia' ||
      /^\/rezerwacje\/\d+$/.test(location.pathname);
    if (!shouldRefetch) return;
    fetch('/api/notifications')
      .then(r => r.json() as Promise<{ count: number }>)
      .then(({ count }) => {
        setLiveNotifCount(count);
        knownNotifRef.current = count;
      })
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const base = 'Rezerwacja Sal';
    const total = livePendingCount + liveNotifCount;
    document.title = total > 0 ? `(${total}) ${base}` : base;
    return () => { document.title = base; };
  }, [livePendingCount, liveNotifCount]);

  const nav = [
    { to: "/", label: "Kalendarz", icon: CalendarDays },
    ...(canManageBookings(user.role) ? [{ to: "/admin/dzisiaj", label: "Dzisiaj", icon: CalendarCheck }] : []),
    ...(canManageBookings(user.role) ? [{ to: "/admin/rezerwacje", label: "Prośby o rezerwacje", icon: ClipboardList }] : []),
    ...(canManageBookings(user.role) ? [{ to: "/admin/panel", label: "Rezerwacje", icon: CalendarRange }] : []),
    ...(canManageUsers(user.role)    ? [{ to: "/admin/uzytkownicy", label: "Użytkownicy", icon: Users }] : []),
    ...(canManageRooms(user)         ? [{ to: "/admin/sale", label: "Sale", icon: DoorOpen }] : []),
    ...(canViewAuditLogs(user.role)  ? [{ to: "/admin/logi", label: "Logi", icon: ScrollText }] : []),
    { to: "/powiadomienia", label: "Powiadomienia", icon: Bell },
    { to: "/ustawienia", label: "Ustawienia", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200">
        <Link to="/" className="flex flex-col items-center justify-center h-20 px-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
          <img src="/assets/Lafrentz - logo podstawowe RGB.svg" alt="Lafrentz" className="h-8" />
          <span className="text-[11px] font-bold text-gray-600 tracking-[0.2em] uppercase mt-1">Rezerwacja Sal</span>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            const isPending = to === "/admin/rezerwacje" && livePendingCount > 0;
            const isNotif   = to === "/powiadomienia"   && liveNotifCount > 0;
            const hasBadge  = isPending || isNotif;
            const badgeCount = isPending ? livePendingCount : liveNotifCount;
            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) => {
                  const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors";
                  if (isActive) return `${base} bg-blue-50 text-blue-700`;
                  if (hasBadge) return `${base} text-amber-700 hover:bg-amber-50 nav-blink`;
                  return `${base} text-gray-600 hover:bg-gray-100 hover:text-gray-900`;
                }}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {hasBadge && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center leading-none">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold select-none shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Wyloguj się
            </button>
          </Form>
          <Link to="/regulamin" className="block px-3 pt-2 text-xs text-gray-400 hover:text-gray-600 hover:underline">
            Regulamin
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200">
        <img src="/assets/Lafrentz - sygnet RGB.svg" alt="Lafrentz" className="h-8" />
        <button onClick={() => setMobileOpen(v => !v)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setMobileOpen(false)}>
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl pt-14 flex flex-col" onClick={e => e.stopPropagation()}>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {nav.map(({ to, label, icon: Icon }) => {
                const isPending = to === "/admin/rezerwacje" && livePendingCount > 0;
                const isNotif   = to === "/powiadomienia"   && liveNotifCount > 0;
                const hasBadge  = isPending || isNotif;
                const badgeCount = isPending ? livePendingCount : liveNotifCount;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => {
                      const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors";
                      if (isActive) return `${base} bg-blue-50 text-blue-700`;
                      if (hasBadge) return `${base} text-amber-700 hover:bg-amber-50 nav-blink`;
                      return `${base} text-gray-600 hover:bg-gray-100`;
                    }}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{label}</span>
                    {hasBadge && (
                      <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center leading-none">
                        {badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 px-3 py-4">
              <Form method="post" action="/logout">
                <button type="submit" className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600">
                  <LogOut size={16} />
                  Wyloguj się
                </button>
              </Form>
              <Link to="/regulamin" onClick={() => setMobileOpen(false)} className="block px-3 pt-2 text-xs text-gray-400 hover:text-gray-600 hover:underline">
                Regulamin
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col mt-14 md:mt-0">
        <Outlet />
      </main>
    </div>
  );
}

