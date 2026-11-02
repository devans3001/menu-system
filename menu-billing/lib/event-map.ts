import type { RegistryStore } from "./registry";
import { slugFromPayload } from "./registry";

// Event-to-state mapping exactly per homework Section 3.3.
// charge.success -> live (monthly) / lifetime (one-time)
// invoice.payment_failed -> grace, grace_until +7 days, menu STAYS LIVE
// subscription.disable -> paused only after grace, or when Evans ordered it
// subscription.create / invoice.create / subscription.not_renew -> log, no premature state flip
// subscription.expiring_cards -> notify only
export async function handlePaystackEvent(store: RegistryStore, eventType: string, payload: any): Promise<{ slug: string | null; action: string }> {
  const slug = slugFromPayload(payload);
  const reference: string | null = payload?.data?.reference ?? null;
  await store.appendPaymentEvent({ slug, eventType, paystackReference: reference, payload, receivedAt: new Date().toISOString() });
  if (!slug) return { slug: null, action: "logged_unmatched" };
  const row = await store.getRestaurant(slug);
  const mode = row?.billingMode ?? payload?.data?.metadata?.billing_mode ?? "monthly";
  const now = new Date().toISOString();
  const base = { slug, lastEvent: eventType, lastEventAt: now };
  switch (eventType) {
    case "subscription.create": {
      await store.upsertRestaurant({ ...base, paystackSubscriptionCode: payload?.data?.subscription_code ?? row?.paystackSubscriptionCode ?? null, paystackCustomerCode: payload?.data?.customer?.customer_code ?? row?.paystackCustomerCode ?? null, paystackEmailToken: payload?.data?.email_token ?? row?.paystackEmailToken ?? null });
      return { slug, action: "subscription_stored_state_unchanged" };
    }
    case "charge.success": {
      const next = payload?.data?.next_payment_date ?? null;
      if (mode === "one_time") await store.upsertRestaurant({ ...base, state: "lifetime", nextPaymentDate: null, graceUntil: null, paystackAuthorizationCode: payload?.data?.authorization?.authorization_code ?? row?.paystackAuthorizationCode ?? null });
      else await store.upsertRestaurant({ ...base, state: "live", graceUntil: null, nextPaymentDate: next, paystackAuthorizationCode: payload?.data?.authorization?.authorization_code ?? row?.paystackAuthorizationCode ?? null });
      return { slug, action: mode === "one_time" ? "state_lifetime" : "state_live" };
    }
    case "invoice.create": return { slug, action: "logged_early_warning" };
    case "invoice.payment_failed": {
      const graceUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await store.upsertRestaurant({ ...base, state: "grace", graceUntil });
      // Menu STAYS LIVE during grace. Notify Evans plus client fix link in production.
      return { slug, action: "state_grace_menu_stays_live" };
    }
    case "invoice.update": return { slug, action: "logged_reconcile" };
    case "subscription.not_renew": return { slug, action: "logged_stays_live_until_period_end" };
    case "subscription.disable": {
      const inGrace = row?.graceUntil ? new Date(row.graceUntil).getTime() > Date.now() : false;
      if (row?.manualPauseOrdered || !inGrace) await store.upsertRestaurant({ ...base, state: "paused" });
      else await store.upsertRestaurant({ ...base }); // still in grace: stay in grace, pause lands after grace_until
      return { slug, action: row?.manualPauseOrdered || !inGrace ? "state_paused" : "deferred_until_grace_ends" };
    }
    case "subscription.expiring_cards": return { slug, action: "notify_evans_only" };
    default: return { slug, action: "logged_no_mapping" };
  }
}
