import { data, redirect, Form, Link, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { getTokenFromRequest, getSessionUser, verifyPassword, createSession, setSessionCookie } from "~/lib/auth.server";
import { queryOne } from "~/lib/db.server";
import type { User } from "~/types";
import { CalendarDays } from "lucide-react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = await getSessionUser(env.DB, token);
  if (user) return redirect("/");

  const observerSettings = await queryOne<{ is_enabled: number }>(env.DB, "SELECT is_enabled FROM observer_settings WHERE id = 1");
  return { observerEnabled: observerSettings?.is_enabled === 1 };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const form = await request.formData();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  const password = form.get("password") as string;

  if (!email || !password) {
    return data({ error: "Wypełnij wszystkie pola." }, { status: 400 });
  }

  const user = await queryOne<User>(env.DB, "SELECT * FROM users WHERE email = ? AND is_active = 1", [email]);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return data({ error: "Nieprawidłowy e-mail lub hasło." }, { status: 401 });
  }

  const token = await createSession(env.DB, user.id);
  const headers = new Headers();
  headers.set("Set-Cookie", setSessionCookie(token, request));

  if (user.must_change_password) {
    return redirect("/ustawienia?zmien-haslo=1", { headers });
  }
  return redirect("/", { headers });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const { observerEnabled } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8">
        <img src="/assets/Lafrentz - logo podstawowe RGB.svg" alt="Lafrentz" className="h-12" />
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">Logowanie</h1>

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Adres e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Hasło
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {actionData?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {actionData.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {pending ? "Logowanie…" : "Zaloguj się"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Jeśli zapomniałeś hasła, skontaktuj się z recepcją.
          </p>
        </Form>
      </div>

      {observerEnabled && (
        <Link
          to="/obserwator"
          className="mt-6 w-full max-w-sm flex items-center justify-center gap-2 bg-white hover:bg-blue-50 border-2 border-blue-600 text-blue-700 font-semibold rounded-lg px-4 py-2.5 text-sm shadow-sm transition-colors"
        >
          <CalendarDays size={17} />
          Podgląd kalendarzy
        </Link>
      )}

      <p className="mt-6 text-xs text-gray-400">System wewnętrzny — dostęp tylko dla pracowników Lafrentz</p>
      <Link to="/regulamin" className="mt-1 text-xs text-gray-400 hover:text-gray-600 hover:underline">
        Regulamin
      </Link>
    </div>
  );
}
