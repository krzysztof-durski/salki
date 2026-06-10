import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { getTokenFromRequest, deleteSession, clearSessionCookie } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  if (token) await deleteSession(env.DB, token);
  return redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function loader() {
  return redirect("/login");
}
