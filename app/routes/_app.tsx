import { Outlet, Link, Form, useLocation, NavLink } from "react-router";
import type { Route } from "./+types/_app";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { canManageBookings, canManageUsers, canViewAuditLogs, canManageRooms } from "~/types";
import {
  CalendarDays, Settings, LogOut, Users, DoorOpen, ScrollText, ClipboardList, Menu, X, Bell, CalendarRange
} from "lucide-react";
import { useState } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  return { user };
}

export default function AppShell({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = [
    { to: "/", label: "Kalendarz", icon: CalendarDays },
    ...(canManageBookings(user.role) ? [{ to: "/admin/rezerwacje", label: "Prośby o rezerwacje", icon: ClipboardList }] : []),
    ...(canManageBookings(user.role) ? [{ to: "/admin/panel", label: "Rezerwacje", icon: CalendarRange }] : []),
    ...(canManageUsers(user.role)    ? [{ to: "/admin/uzytkownicy", label: "Użytkownicy", icon: Users }] : []),
    ...(canManageRooms(user.role)    ? [{ to: "/admin/sale", label: "Sale", icon: DoorOpen }] : []),
    ...(canViewAuditLogs(user.role)  ? [{ to: "/admin/logi", label: "Logi", icon: ScrollText }] : []),
    { to: "/ustawienia", label: "Ustawienia", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200">
        <div className="flex items-center h-16 px-4 border-b border-gray-200">
          <img src="/assets/Lafrentz - logo podstawowe RGB.svg" alt="Lafrentz" className="h-8" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200 px-3 py-4">
          {user.role === "admin" && (
            <Form method="post" action="/logout" className="w-full mb-2">
              <OnDutyToggle onDuty={!!user.on_duty} />
            </Form>
          )}
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold select-none">
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
              {nav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                    }`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-gray-200 px-3 py-4">
              <Form method="post" action="/logout">
                <button type="submit" className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600">
                  <LogOut size={16} />
                  Wyloguj się
                </button>
              </Form>
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

function OnDutyToggle({ onDuty }: { onDuty: boolean }) {
  return (
    <Form method="post" action="/ustawienia">
      <input type="hidden" name="_action" value="toggle_duty" />
      <button
        type="submit"
        className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${
          onDuty
            ? "bg-green-50 text-green-700 hover:bg-green-100"
            : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        <Bell size={16} />
        {onDuty ? "Dyżur aktywny" : "Włącz dyżur"}
      </button>
    </Form>
  );
}
