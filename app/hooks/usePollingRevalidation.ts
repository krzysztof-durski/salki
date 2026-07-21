import { useRevalidator } from "react-router";
import { useEffect } from "react";

// Keeps a page's loader data fresh while it's left open — e.g. an admin
// approves a booking while the requester still has its detail page open, or
// the shared calendar display picks up someone else's change. Mirrors the
// polling pattern already used for the sidebar's pending/notification
// badges (app/routes/_app.tsx), just generalized to revalidate any route's
// loader instead of hitting a dedicated count endpoint.
export function usePollingRevalidation(intervalMs = 20_000) {
  const revalidator = useRevalidator();

  useEffect(() => {
    const id = setInterval(() => {
      // Skip while the tab isn't visible (nothing to refresh for) or a
      // revalidation/navigation is already in flight (avoid piling up).
      if (document.visibilityState !== "visible") return;
      if (revalidator.state !== "idle") return;
      revalidator.revalidate();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, revalidator]);
}
