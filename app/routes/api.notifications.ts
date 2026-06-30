import type { Route } from "./+types/api.notifications";
import { getTokenFromRequest, getSessionUser } from "~/lib/auth.server";
import { queryOne, execute } from "~/lib/db.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = await getSessionUser(env.DB, token);
  if (!user) return Response.json({ count: 0 });

  // ~5% of requests: purge rejected bookings older than 7 days
  if (Math.random() < 0.05) {
    context.cloudflare.ctx.waitUntil(
      execute(
        env.DB,
        "DELETE FROM bookings WHERE status = 'rejected' AND updated_at < datetime('now', '-7 days')",
        []
      )
    );
  }

  const row = await queryOne<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0",
    [user.id]
  );
  return Response.json({ count: row?.n ?? 0 });
}
