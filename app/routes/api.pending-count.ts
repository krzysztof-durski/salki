import type { Route } from "./+types/api.pending-count";
import { getTokenFromRequest, getSessionUser } from "~/lib/auth.server";
import { queryOne } from "~/lib/db.server";
import { canManageBookings } from "~/types";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const token = getTokenFromRequest(request);
  const user = await getSessionUser(env.DB, token);
  if (!user || !canManageBookings(user.role)) {
    return Response.json({ count: 0 });
  }
  const row = await queryOne<{ n: number }>(
    env.DB,
    "SELECT COUNT(*) AS n FROM bookings WHERE status IN ('pending','counter_proposed')"
  );
  return Response.json({ count: row?.n ?? 0 });
}
