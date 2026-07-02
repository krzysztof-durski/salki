import { useState } from "react";
import { redirect, data, Form, useNavigation } from "react-router";
import type { Route } from "./+types/admin.obserwator";
import { getTokenFromRequest, getSessionUser, requireUser } from "~/lib/auth.server";
import { queryOne, execute } from "~/lib/db.server";
import { logAction } from "~/lib/audit.server";
import { canManageObserverSettings } from "~/types";
import { Eye, EyeOff } from "lucide-react";

interface ObserverSettingsRow {
  password: string | null;
  is_enabled: number;
  updated_at: string | null;
  updated_by_name: string | null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageObserverSettings(user.role)) throw new Response(null, { status: 403 });

  const settings = await queryOne<ObserverSettingsRow>(
    env.DB,
    `SELECT s.password, s.is_enabled, s.updated_at, u.name as updated_by_name
     FROM observer_settings s LEFT JOIN users u ON u.id = s.updated_by
     WHERE s.id = 1`
  );

  return { settings };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));
  if (!canManageObserverSettings(user.role)) throw new Response(null, { status: 403 });

  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "set_password") {
    const password = form.get("password") as string;
    const confirm = form.get("password_confirm") as string;
    if (!password || password.length < 8) {
      return data({ error: "Hasło musi mieć co najmniej 8 znaków." }, { status: 400 });
    }
    if (password !== confirm) {
      return data({ error: "Hasła nie są identyczne." }, { status: 400 });
    }
    await execute(
      env.DB,
      `UPDATE observer_settings SET password = ?, is_enabled = 1, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = 1`,
      [password, user.id]
    );
    await logAction(env.DB, { userId: user.id, action: 'observer_settings.updated', entityType: 'observer_settings', details: { change: 'password_set' } });
  }

  else if (_action === "toggle_enabled") {
    await execute(
      env.DB,
      `UPDATE observer_settings SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = 1`,
      [user.id]
    );
    await logAction(env.DB, { userId: user.id, action: 'observer_settings.updated', entityType: 'observer_settings', details: { change: 'toggle_enabled' } });
  }

  return redirect("/admin/obserwator");
}

export default function AdminObserwator({ loaderData, actionData }: Route.ComponentProps) {
  const { settings } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";
  const [reveal, setReveal] = useState(false);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Eye size={22} /> Obserwator
      </h1>
      <p className="text-sm text-gray-500 -mt-4">
        Osoby bez konta mogą podejrzeć kalendarze sal ogólnych (bez sal zarządu) po podaniu wspólnego hasła na stronie logowania.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Dostęp obserwatora</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {settings?.is_enabled ? "Włączony — link widoczny na stronie logowania." : "Wyłączony — link ukryty."}
            </p>
          </div>
          <Form method="post">
            <input type="hidden" name="_action" value="toggle_enabled" />
            <button
              type="submit"
              disabled={pending}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                settings?.is_enabled
                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                  : "bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {settings?.is_enabled ? "Wyłącz" : "Włącz"}
            </button>
          </Form>
        </div>
        {settings?.updated_at && (
          <p className="text-xs text-gray-400">
            Ostatnia zmiana: {settings.updated_at.replace('T', ' ').slice(0, 16)}
            {settings.updated_by_name ? ` przez ${settings.updated_by_name}` : ''}
          </p>
        )}
      </div>

      {settings?.password && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Aktualne hasło</h2>
          <div className="flex items-center gap-2">
            <input
              type={reveal ? "text" : "password"}
              readOnly
              value={settings.password}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
            />
            <button
              type="button"
              onClick={() => setReveal(v => !v)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label={reveal ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Ustaw nowe hasło obserwatora</h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="set_password" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Nowe hasło</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password_confirm">Powtórz hasło</label>
            <input
              id="password_confirm"
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {actionData?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Zapisz hasło
          </button>
        </Form>
      </div>
    </div>
  );
}
