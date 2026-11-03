import type { RegistryStore } from "./registry";
import { slugFromPayload } from "./registry";

// Event-to-state mapping exactly per homework Section 3.3.
// charge.success -> live (monthly) / lifetime (one-time)
// invoice.payment_failed -> grace, grace_until +7 days, menu STAYS LIVE
// subscription.disable -> paused only after grace, or when Evans ordered it
// subscription.create / invoice.create / subscription.not_renew -> log, no premature state flip
// subscription.expiring_cards -> notify only
//
// Slug linking (fixed Nov 3, 2026, from the genuine payment proof):
// Paystack's subscription.create carries no metadata slug, so it used
// to log unmatched and the real customer/subscription codes and next
// payment date never reached the registry (renewals and pauses act on
// those codes, so this mattered). Now the slug resolves three ways:
// the payload metadata when present; the customer code already stored
// on a restaurant row; and a pending-subscription park keyed by
// customer code, drained when the matching charge.success lands.
// Webhook order is not guaranteed, and both orders are handled.
export async function handlePaystackEvent(store: RegistryStore, eventType: string, payload: any): Promise<{ slug: string | null; action: string }> {
  const customerCode: string | null = payload?.data?.customer?.customer_code ?? null;
  let slug = slugFromPayload(payload);
  if (!slug && customerCode) slug = await store.findSlugByCustomerCode(customerCode);
  const reference: string | null = payload?.data?.reference ?? null;
  await store.appendPaymentEvent({ slug, eventType, paystackReference: reference, payload, receivedAt: new Date().toISOString() });

  if (eventType === "subscription.create" && !slug) {
    // No way to name the menu yet: park the subscription by customer
    // so its charge can claim it. Logged, never dropped.
    if (customerCode) {
      await store.savePendingSubscription({
        customerCode,
        subscriptionCode: payload?.data?.subscription_code ?? null,
        emailToken: payload?.data?.email_token ?? null,
        nextPaymentDate: payload?.data?.next_payment_date ?? null,
        planCode: payload?.data?.plan?.plan_code ?? null,
      });
      return { slug: null, action: "logged_pending_subscription_link" };
    }
    return { slug: null, action: "logged_unmatched" };
  }
  if (!slug) return { slug: null, action: "logged_unmatched" };

  const row = await store.getRestaurant(slug);
  const mode = row?.billingMode ?? payload?.data?.metadata?.billing_mode ?? "monthly";
  const now = new Date().toISOString();
  const base = { slug, lastEvent: eventType, lastEventAt: now };
  switch (eventType) {
    case "subscription.create": {
      await store.upsertRestaurant({
        ...base,
        paystackSubscriptionCode: payload?.data?.subscription_code ?? row?.paystackSubscriptionCode ?? null,
        paystackCustomerCode: customerCode ?? row?.paystackCustomerCode ?? null,
        paystackEmailToken: payload?.data?.email_token ?? row?.paystackEmailToken ?? null,
        nextPaymentDate: payload?.data?.next_payment_date ?? row?.nextPaymentDate ?? null,
      });
      return { slug, action: "subscription_stored_state_unchanged" };
    }
    case "charge.success": {
      if (mode === "one_time") {
        await store.upsertRestaurant({ ...base, state: "lifetime", nextPaymentDate: null, graceUntil: null, paystackCustomerCode: customerCode ?? row?.paystackCustomerCode ?? null, paystackAuthorizationCode: payload?.data?.authorization?.authorization_code ?? row?.paystackAuthorizationCode ?? null });
        return { slug, action: "state_lifetime" };
      }
      // Monthly: claim any parked subscription for this customer so
      // the row carries the REAL subscription code, email token and
      // next payment date, not leftovers from any earlier test.
      const pending = customerCode ? await store.getPendingSubscription(customerCode) : null;
      const next = payload?.data?.next_payment_date ?? pending?.nextPaymentDate ?? row?.nextPaymentDate ?? null;
      await store.upsertRestaurant({
        ...base, state: "live", graceUntil: null, nextPaymentDate: next,
        paystackCustomerCode: customerCode ?? row?.paystackCustomerCode ?? null,
        paystackSubscriptionCode: pending?.subscriptionCode ?? row?.paystackSubscriptionCode ?? null,
        paystackEmailToken: pending?.emailToken ?? row?.paystackEmailToken ?? null,
        paystackAuthorizationCode: payload?.data?.authorization?.authorization_code ?? row?.paystackAuthorizationCode ?? null,
      });
      if (pending && customerCode) await store.clearPendingSubscription(customerCode);
      return { slug, action: pending ? "state_live_subscription_linked" : "state_live" };
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
