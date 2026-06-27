import { redirect, data, Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/ustawienia";
import { getTokenFromRequest, getSessionUser, requireUser, hashPassword, verifyPassword } from "~/lib/auth.server";
import { queryAll, execute } from "~/lib/db.server";
import type { Room } from "~/types";
import { sendEmail, tplDutyOff } from "~/lib/email.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const rooms = await queryAll<Room>(
    env.DB,
    "SELECT id, name, category FROM rooms WHERE is_active=1 ORDER BY sort_order"
  );

  const url = new URL(request.url);
  const forcePasswordChange = url.searchParams.get("zmien-haslo") === "1";

  return { user, rooms, forcePasswordChange };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = requireUser(await getSessionUser(env.DB, token));

  const form = await request.formData();
  const _action = form.get("_action") as string;

  if (_action === "change_password") {
    const current = form.get("current_password") as string;
    const next = form.get("new_password") as string;
    const confirm = form.get("confirm_password") as string;
    const wasForced = form.get("was_forced") === "1";

    if (!next || next.length < 8) return data({ error: "Hasło musi mieć co najmniej 8 znaków." }, { status: 400 });
    if (next !== confirm) return data({ error: "Hasła nie są identyczne." }, { status: 400 });

    if (!user.must_change_password) {
      if (!current) return data({ error: "Podaj aktualne hasło." }, { status: 400 });
      const valid = await verifyPassword(current, user.password_hash);
      if (!valid) return data({ error: "Aktualne hasło jest nieprawidłowe." }, { status: 401 });
    }

    const hash = await hashPassword(next);
    await execute(
      env.DB,
      "UPDATE users SET password_hash=?, must_change_password=0, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [hash, user.id]
    );
    // After forced first-login password change, go straight to the app
    return redirect(wasForced ? "/" : "/ustawienia?ok=1");
  }

  if (_action === "preferred_room") {
    const roomId = form.get("preferred_room_id") ? parseInt(form.get("preferred_room_id") as string, 10) : null;
    await execute(env.DB, "UPDATE users SET preferred_room_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [roomId, user.id]);
    return redirect("/ustawienia?ok=1");
  }

  if (_action === "toggle_duty") {
    if (user.role === 'admin' || user.role === 'super_admin') {
      const turningOff = user.on_duty === 1;
      await execute(
        env.DB,
        "UPDATE users SET on_duty=CASE WHEN on_duty=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [user.id]
      );
      if (turningOff) {
        const otherAdmins = await queryAll<{ email: string }>(
          env.DB,
          "SELECT email FROM users WHERE role IN ('admin','super_admin') AND is_active=1 AND id != ?",
          [user.id]
        );
        const emails = otherAdmins.map(a => a.email);
        if (emails.length > 0) {
          const tpl = tplDutyOff({ adminName: user.name });
          await sendEmail(env, { to: emails, ...tpl });
        }
      }
    }
    return redirect("/ustawienia");
  }

  return null;
}

export default function Ustawienia({ loaderData, actionData }: Route.ComponentProps) {
  const { user, rooms, forcePasswordChange } = loaderData;
  const nav = useNavigation();
  const [searchParams] = useSearchParams();
  const pending = nav.state === "submitting";
  const saved = searchParams.get("ok") === "1";

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Ustawienia</h1>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
          Zmiany zostały zapisane.
        </div>
      )}

      {forcePasswordChange && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm font-medium">
          Zalogowano pomyślnie! Ustaw swoje hasło, aby kontynuować.
        </div>
      )}

      {/* Change password */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">{forcePasswordChange ? "Ustaw nowe hasło" : "Zmiana hasła"}</h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="change_password" />
          <input type="hidden" name="was_forced" value={forcePasswordChange ? "1" : "0"} />
          {!user.must_change_password && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aktualne hasło</label>
              <input name="current_password" type="password" autoComplete="current-password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nowe hasło</label>
            <input name="new_password" type="password" autoComplete="new-password" required minLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Powtórz nowe hasło</label>
            <input name="confirm_password" type="password" autoComplete="new-password" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          {actionData?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionData.error}</p>
          )}
          <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {pending ? "Zapisuję…" : forcePasswordChange ? "Ustaw hasło i przejdź dalej" : "Zmień hasło"}
          </button>
        </Form>
      </div>

      {/* Preferred room */}
      {!forcePasswordChange && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Ulubiona sala</h2>
          <p className="text-sm text-gray-500">Ta sala będzie domyślnie otwarta po zalogowaniu.</p>
          <Form method="post" className="flex items-center gap-3">
            <input type="hidden" name="_action" value="preferred_room" />
            <select
              name="preferred_room_id"
              defaultValue={user.preferred_room_id ?? ""}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">— brak preferencji —</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Zapisz
            </button>
          </Form>
        </div>
      )}

      {/* On-duty toggle for admins */}
      {(user.role === 'admin' || user.role === 'super_admin') && !forcePasswordChange && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Dyżur</h2>
          <p className="text-sm text-gray-500">
            Gdy dyżur jest aktywny, otrzymujesz e-maile o nowych wnioskach o rezerwację.
          </p>
          <Form method="post">
            <input type="hidden" name="_action" value="toggle_duty" />
            <button
              type="submit"
              disabled={pending}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                user.on_duty
                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {user.on_duty ? "Dyżur aktywny — wyłącz" : "Dyżur nieaktywny — włącz"}
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}
