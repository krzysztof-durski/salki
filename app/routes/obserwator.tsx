import { data, redirect, Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/obserwator";
import {
  getObserverTokenFromRequest, getObserverSession,
  createObserverSession, setObserverSessionCookie,
} from "~/lib/auth.server";
import { queryOne } from "~/lib/db.server";
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "~/lib/rate-limit.server";

interface ObserverSettings {
  password: string | null;
  is_enabled: number;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getObserverTokenFromRequest(request);
  if (await getObserverSession(env.DB, token)) return redirect("/obserwator/kalendarz");

  const settings = await queryOne<ObserverSettings>(env.DB, "SELECT password, is_enabled FROM observer_settings WHERE id = 1");
  return { enabled: settings?.is_enabled === 1 };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const form = await request.formData();
  const password = form.get("password") as string;

  if (!password) {
    return data({ error: "Wpisz hasło." }, { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const bucketKey = `observer:${ip}`;

  const rl = await checkRateLimit(env.DB, bucketKey);
  if (!rl.allowed) {
    return data({ error: "Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut." }, { status: 429 });
  }

  const settings = await queryOne<ObserverSettings>(env.DB, "SELECT password, is_enabled FROM observer_settings WHERE id = 1");
  if (!settings?.is_enabled || !settings.password || password !== settings.password) {
    await recordFailedAttempt(env.DB, bucketKey);
    return data({ error: "Nieprawidłowe hasło." }, { status: 401 });
  }

  await clearAttempts(env.DB, bucketKey);

  const token = await createObserverSession(env.DB);
  const headers = new Headers();
  headers.set("Set-Cookie", setObserverSessionCookie(token, request));
  return redirect("/obserwator/kalendarz", { headers });
}

export default function Obserwator({ loaderData, actionData }: Route.ComponentProps) {
  const { enabled } = loaderData;
  const nav = useNavigation();
  const pending = nav.state === "submitting";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8">
        <img src="/assets/Lafrentz - logo podstawowe RGB.svg" alt="Lafrentz" className="h-12" />
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">Podgląd kalendarzy</h1>

        {!enabled ? (
          <p className="text-sm text-gray-500 text-center">Podgląd jest obecnie niedostępny.</p>
        ) : (
          <Form method="post" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Hasło dostępu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="off"
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
              {pending ? "Sprawdzanie…" : "Pokaż kalendarze"}
            </button>
          </Form>
        )}
      </div>

      <a href="/login" className="mt-6 text-xs text-gray-400 hover:text-gray-600 hover:underline">
        Wróć do logowania
      </a>
    </div>
  );
}
