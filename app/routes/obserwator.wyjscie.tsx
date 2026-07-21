import { redirect } from "react-router";
import type { Route } from "./+types/obserwator.wyjscie";
import { getObserverTokenFromRequest, deleteObserverSession, clearObserverSessionCookie } from "~/lib/auth.server";
import { logAction } from "~/lib/audit.server";

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getObserverTokenFromRequest(request);
  if (token) {
    await deleteObserverSession(env.DB, token);
    await logAction(env.DB, { userId: null, action: 'auth.observer_logout', entityType: 'observer_session', request });
  }
  return redirect("/obserwator", {
    headers: { "Set-Cookie": clearObserverSessionCookie(request) },
  });
}

export async function loader() {
  return redirect("/obserwator");
}
