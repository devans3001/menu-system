// Server-side read of a restaurant's billing state from the shared Neon
// registry (restaurants table, written by the menu-billing webhook service).
// Import this only from server components and route handlers, never from
// client components: DATABASE_URL is a server-only secret.
//
// Returns null when DATABASE_URL is unset, when the restaurant has no
// registry row yet, or when the database cannot be reached, so callers can
// fall back to the seed/demo state in restaurant.config.ts.
import { neon } from "@neondatabase/serverless";

export async function getBillingStateFromRegistry(slug: string): Promise<string | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const sql = neon(url);
    const found = await sql.query(
      "SELECT state, grace_until FROM restaurants WHERE slug = $1",
      [slug],
    );
    const row = found[0] as { state?: unknown; grace_until?: unknown } | undefined;
    if (!row?.state) return null;
    const state = String(row.state);
    // menu-billing defers a pause while grace is running: subscription.disable
    // inside grace leaves the row in "grace", and the pause lands when
    // grace_until passes. The guest page honours that here.
    if (state === "grace" && row.grace_until) {
      const until = row.grace_until instanceof Date ? row.grace_until.getTime() : new Date(String(row.grace_until)).getTime();
      if (!Number.isNaN(until) && until <= Date.now()) return "paused";
    }
    return state;
  } catch (err) {
    console.error("[registry-status] Neon read failed, falling back to config state:", err);
    return null;
  }
}
