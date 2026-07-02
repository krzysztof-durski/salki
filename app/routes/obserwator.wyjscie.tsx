import { redirect } from "react-router";
import type { Route } from "./+types/obserwator.wyjscie";
import { getObserverTokenFromRequest, deleteObserverSession, clearObserverSessionCookie } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getObserverTokenFromRequest(request);
  if (token) await deleteObserverSession(env.DB, token);
  return redirect("/obserwator", {
    headers: { "Set-Cookie": clearObserverSessionCookie(request) },
  });
}

export async function loader() {
  return redirect("/obserwator");
}
