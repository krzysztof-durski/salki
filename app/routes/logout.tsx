import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { getTokenFromRequest, getSessionUser, deleteSession, clearSessionCookie } from "~/lib/auth.server";
import { logAction } from "~/lib/audit.server";

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  if (token) {
    const user = await getSessionUser(env.DB, token);
    await deleteSession(env.DB, token);
    if (user) await logAction(env.DB, { userId: user.id, action: 'auth.logout', entityType: 'user', entityId: user.id, request });
  }
  return redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie(request) },
  });
}

export async function loader() {
  return redirect("/login");
}
