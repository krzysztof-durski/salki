import type { Route } from "./+types/api.notifications";
import { getTokenFromRequest, getSessionUser } from "~/lib/auth.server";
import { queryOne } from "~/lib/db.server";
import { runRetentionCleanup } from "~/lib/retention.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = await getSessionUser(env.DB, token);
  if (!user) return Response.json({ count: 0 });

  // No native cron on Cloudflare Pages: piggyback retention cleanup on this
  // endpoint, which every logged-in user polls every 20s (see _app.tsx).
  // ~5% of polls trigger it, so it runs roughly every ~7 minutes per active user.
  if (Math.random() < 0.05) {
    context.cloudflare.ctx.waitUntil(runRetentionCleanup(env.DB));
  }

  const row = await queryOne<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0",
    [user.id]
  );
  return Response.json({ count: row?.n ?? 0 });
}
