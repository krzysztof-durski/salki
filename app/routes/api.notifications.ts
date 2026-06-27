import type { Route } from "./+types/api.notifications";
import { getTokenFromRequest, getSessionUser } from "~/lib/auth.server";
import { queryOne } from "~/lib/db.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = await getSessionUser(env.DB, token);
  if (!user) return Response.json({ count: 0 });

  const row = await queryOne<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0",
    [user.id]
  );
  return Response.json({ count: row?.n ?? 0 });
}
