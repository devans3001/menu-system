// Daily owner-alert scan (Nov 3, 2026). Webhooks cover the moments
// Paystack reports, but three useful warnings have no webhook day:
// a renewal three days out, the middle of a grace week, and the last
// day of grace. This scan walks the registry's monthly rows once a
// day (Vercel cron, see vercel.json) and sends those, deduped by the
// notifications table so a repeat run never nags twice per cycle.
import type { RegistryStore } from "./registry";
import { notifyOwner, renewalUpcomingContent, graceMidContent, graceFinalContent } from "./notify";

const DAY = 24 * 60 * 60 * 1000;
const dateKey = (iso: string | null): string => (iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10));

export interface ScanSummary { checked: number; alerts: { slug: string; kind: string; outcome: string }[] }

export async function runBillingAlertScan(store: RegistryStore, now = new Date()): Promise<ScanSummary> {
  const candidates = await store.listAlertCandidates();
  const alerts: ScanSummary["alerts"] = [];
  const send = async (slug: string, kind: string, run: () => Promise<string>) => {
    try { alerts.push({ slug, kind, outcome: await run() }); }
    catch (err) { alerts.push({ slug, kind, outcome: `failed: ${err instanceof Error ? err.message : String(err)}` }); }
  };

  for (const r of candidates) {
    if (r.state === "live" && r.nextPaymentDate) {
      const due = new Date(r.nextPaymentDate).getTime();
      const inDays = (due - now.getTime()) / DAY;
      if (inDays > 0 && inDays <= 3) {
        await send(r.slug, "renewal_upcoming", () => notifyOwner(store, {
          slug: r.slug, kind: "renewal_upcoming", cycleKey: dateKey(r.nextPaymentDate), recipient: r.ownerEmail, subscriptionCode: r.paystackSubscriptionCode,
          build: (link) => renewalUpcomingContent(r.slug, r.nextPaymentDate, link),
        }));
      }
    }
    if (r.state === "grace" && r.graceUntil) {
      const until = new Date(r.graceUntil).getTime();
      const remaining = (until - now.getTime()) / DAY;
      if (remaining > 0 && remaining <= 1) {
        await send(r.slug, "grace_final", () => notifyOwner(store, {
          slug: r.slug, kind: "grace_final", cycleKey: dateKey(r.graceUntil), recipient: r.ownerEmail, subscriptionCode: r.paystackSubscriptionCode,
          build: (link) => graceFinalContent(r.slug, r.graceUntil, link),
        }));
      } else if (remaining > 1 && remaining <= 4) {
        // Grace lasts 7 days, so 1 to 4 days left is the middle of
        // the window: one reminder, neither at the panic start nor
        // only at the last day.
        await send(r.slug, "grace_mid", () => notifyOwner(store, {
          slug: r.slug, kind: "grace_mid", cycleKey: dateKey(r.graceUntil), recipient: r.ownerEmail, subscriptionCode: r.paystackSubscriptionCode,
          build: (link) => graceMidContent(r.slug, r.graceUntil, link),
        }));
      }
    }
  }
  return { checked: candidates.length, alerts };
}
