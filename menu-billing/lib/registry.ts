// Registry write interface. Append-only payment_events plus restaurant state updates.
// When DATABASE_URL is set, getRegistry() returns a Neon-backed store
// (@neondatabase/serverless) running SQL against the schema in
// menu-template/schema.sql. When it is unset, an in-memory store keeps
// local dev and webhook mapping tests working with no database.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export interface PaymentEventRecord { slug: string | null; eventType: string; paystackReference: string | null; payload: unknown; receivedAt: string }
export interface RestaurantRow {
  slug: string; state: string; billingMode: "monthly" | "one_time";
  paystackCustomerCode: string | null; paystackSubscriptionCode: string | null;
  paystackEmailToken: string | null; paystackAuthorizationCode: string | null;
  nextPaymentDate: string | null; graceUntil: string | null;
  lastEvent: string | null; lastEventAt: string | null;
  ownerEmail: string | null; // captured from Paystack customer payloads; owner alerts go here
  manualPauseOrdered?: boolean; // Evans orders a pause; honoured on subscription.disable
}
// One owner alert (Nov 3, 2026). The (slug, kind, cycleKey) triple is
// the dedupe key: a webhook retry or a repeat scan can never send the
// same alert for the same billing cycle twice, while a new cycle
// (new grace deadline, new renewal date) alerts again.
export interface NotificationRecord {
  slug: string; kind: string; cycleKey: string;
  recipient: string | null; subject: string; body: string;
  status: "sent" | "recorded" | "failed" | "no_recipient";
  providerId: string | null; detail: string;
}
export interface AlertCandidate {
  slug: string; state: string; billingMode: "monthly" | "one_time";
  nextPaymentDate: string | null; graceUntil: string | null;
  ownerEmail: string | null; paystackSubscriptionCode: string | null;
}
// A subscription that arrived before its menu could be identified.
// Paystack's subscription.create carries NO metadata slug (proven by
// the genuine ₦10,000 test payment, Nov 3, 2026: it logged unmatched
// while its charge.success, seconds later, carried the slug). The
// subscription is therefore parked here, keyed by customer code, and
// linked into the restaurant row when the charge for the same
// customer lands. If the charge somehow arrives first, the charge
// handler finds nothing parked and the create handler later resolves
// the slug from the customer code the charge stored (order-safe).
export interface PendingSubscription {
  customerCode: string;
  subscriptionCode: string | null;
  emailToken: string | null;
  nextPaymentDate: string | null;
  planCode: string | null;
}
export interface RegistryStore {
  appendPaymentEvent(rec: PaymentEventRecord): Promise<void>;
  getRestaurant(slug: string): Promise<RestaurantRow | null>;
  upsertRestaurant(row: Partial<RestaurantRow> & { slug: string }): Promise<void>;
  savePendingSubscription(rec: PendingSubscription): Promise<void>;
  getPendingSubscription(customerCode: string): Promise<PendingSubscription | null>;
  clearPendingSubscription(customerCode: string): Promise<void>;
  findSlugByCustomerCode(customerCode: string): Promise<string | null>;
  recordNotification(rec: NotificationRecord): Promise<boolean>; // false when the cycle already has this alert
  hasNotification(slug: string, kind: string, cycleKey: string): Promise<boolean>;
  listAlertCandidates(): Promise<AlertCandidate[]>;
}

// ---------------------------------------------------------------------------
// In-memory store (local dev, DATABASE_URL unset)
// ---------------------------------------------------------------------------
const events: PaymentEventRecord[] = [];
const rows = new Map<string, RestaurantRow>();
const pendingSubs = new Map<string, PendingSubscription>();
const notificationKeys = new Set<string>();
export const notificationsLog: NotificationRecord[] = [];
export const inMemoryRegistry: RegistryStore = {
  async appendPaymentEvent(rec) { events.push(rec); console.log("[payment_events append]", rec.eventType, rec.slug); },
  async getRestaurant(slug) { return rows.get(slug) ?? null; },
  async upsertRestaurant(patch) {
    const prev = rows.get(patch.slug) ?? { slug: patch.slug, state: "awaiting_payment", billingMode: "monthly" as const, paystackCustomerCode: null, paystackSubscriptionCode: null, paystackEmailToken: null, paystackAuthorizationCode: null, nextPaymentDate: null, graceUntil: null, lastEvent: null, lastEventAt: null, ownerEmail: null };
    rows.set(patch.slug, { ...prev, ...patch } as RestaurantRow);
  },
  async savePendingSubscription(rec) { pendingSubs.set(rec.customerCode, rec); },
  async getPendingSubscription(customerCode) { return pendingSubs.get(customerCode) ?? null; },
  async clearPendingSubscription(customerCode) { pendingSubs.delete(customerCode); },
  async findSlugByCustomerCode(customerCode) {
    for (const r of rows.values()) if (r.paystackCustomerCode === customerCode) return r.slug;
    return null;
  },
  async recordNotification(rec) {
    const key = `${rec.slug}|${rec.kind}|${rec.cycleKey}`;
    if (notificationKeys.has(key)) return false;
    notificationKeys.add(key);
    notificationsLog.push(rec);
    console.log("[notification]", rec.kind, rec.slug, rec.status);
    return true;
  },
  async hasNotification(slug, kind, cycleKey) { return notificationKeys.has(`${slug}|${kind}|${cycleKey}`); },
  async listAlertCandidates() {
    return [...rows.values()]
      .filter(r => r.billingMode === "monthly" && (r.state === "live" || r.state === "grace"))
      .map(r => ({ slug: r.slug, state: r.state, billingMode: r.billingMode, nextPaymentDate: r.nextPaymentDate, graceUntil: r.graceUntil, ownerEmail: r.ownerEmail, paystackSubscriptionCode: r.paystackSubscriptionCode }));
  },
};

// ---------------------------------------------------------------------------
// Neon store (DATABASE_URL set)
// Tables: restaurants, payment_events (see menu-template/schema.sql).
// ---------------------------------------------------------------------------
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// camelCase patch field -> restaurants column. Only fields present in the
// patch are written, so a partial upsert never clobbers columns it does not
// mention (same semantics as the in-memory store's spread merge).
const COLUMN_MAP: Partial<Record<keyof RestaurantRow, string>> = {
  state: "state",
  billingMode: "billing_mode",
  paystackCustomerCode: "paystack_customer_code",
  paystackSubscriptionCode: "paystack_subscription_code",
  paystackEmailToken: "paystack_email_token",
  paystackAuthorizationCode: "paystack_authorization_code",
  nextPaymentDate: "next_payment_date",
  graceUntil: "grace_until",
  lastEvent: "last_event",
  lastEventAt: "last_event_at",
  ownerEmail: "owner_email",
  manualPauseOrdered: "manual_pause_ordered",
};

class NeonRegistryStore implements RegistryStore {
  private sql: NeonQueryFunction<false, false>;
  private pendingReady: Promise<void> | null = null;
  constructor(databaseUrl: string) { this.sql = neon(databaseUrl); }

  // The pending_subscriptions table is also declared in
  // menu-template/schema.sql; creating it here too keeps a billing
  // deploy that lands before a schema re-apply from ever failing a
  // webhook on a missing table.
  private ensurePending(): Promise<void> {
    if (!this.pendingReady) {
      this.pendingReady = this.sql.query(
        `CREATE TABLE IF NOT EXISTS pending_subscriptions (
           customer_code text PRIMARY KEY,
           subscription_code text,
           email_token text,
           next_payment_date timestamptz,
           plan_code text,
           created_at timestamptz NOT NULL DEFAULT now()
         )`,
        [],
      ).then(() => undefined);
    }
    return this.pendingReady;
  }

  async savePendingSubscription(rec: PendingSubscription): Promise<void> {
    await this.ensurePending();
    await this.sql.query(
      `INSERT INTO pending_subscriptions (customer_code, subscription_code, email_token, next_payment_date, plan_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (customer_code) DO UPDATE SET subscription_code = EXCLUDED.subscription_code,
         email_token = EXCLUDED.email_token, next_payment_date = EXCLUDED.next_payment_date, plan_code = EXCLUDED.plan_code`,
      [rec.customerCode, rec.subscriptionCode, rec.emailToken, rec.nextPaymentDate, rec.planCode],
    );
  }

  async getPendingSubscription(customerCode: string): Promise<PendingSubscription | null> {
    await this.ensurePending();
    const found = await this.sql.query(
      "SELECT customer_code, subscription_code, email_token, next_payment_date, plan_code FROM pending_subscriptions WHERE customer_code = $1",
      [customerCode],
    );
    const r = found[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      customerCode: String(r.customer_code),
      subscriptionCode: (r.subscription_code as string | null) ?? null,
      emailToken: (r.email_token as string | null) ?? null,
      nextPaymentDate: toIso(r.next_payment_date),
      planCode: (r.plan_code as string | null) ?? null,
    };
  }

  async clearPendingSubscription(customerCode: string): Promise<void> {
    await this.ensurePending();
    await this.sql.query("DELETE FROM pending_subscriptions WHERE customer_code = $1", [customerCode]);
  }

  async findSlugByCustomerCode(customerCode: string): Promise<string | null> {
    const found = await this.sql.query(
      "SELECT slug FROM restaurants WHERE paystack_customer_code = $1 LIMIT 1",
      [customerCode],
    );
    const r = found[0] as Record<string, unknown> | undefined;
    return r ? String(r.slug) : null;
  }

  async appendPaymentEvent(rec: PaymentEventRecord): Promise<void> {
    // payment_events.slug references restaurants(slug). Make sure the row
    // exists first so the append-only log can never fail on the foreign key
    // when a webhook arrives before onboarding created the registry row.
    if (rec.slug) {
      await this.sql.query(
        "INSERT INTO restaurants (slug) VALUES ($1) ON CONFLICT (slug) DO NOTHING",
        [rec.slug],
      );
    }
    await this.sql.query(
      `INSERT INTO payment_events (slug, event_type, paystack_reference, payload, received_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [rec.slug, rec.eventType, rec.paystackReference, JSON.stringify(rec.payload ?? null), rec.receivedAt],
    );
  }

  async getRestaurant(slug: string): Promise<RestaurantRow | null> {
    await this.ensureAlerts();
    const found = await this.sql.query(
      `SELECT slug, state, billing_mode, paystack_customer_code, paystack_subscription_code,
              paystack_email_token, paystack_authorization_code, next_payment_date,
              grace_until, last_event, last_event_at, manual_pause_ordered, owner_email
       FROM restaurants WHERE slug = $1`,
      [slug],
    );
    const r = found[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      slug: String(r.slug),
      state: String(r.state),
      billingMode: (r.billing_mode === "one_time" ? "one_time" : "monthly"),
      paystackCustomerCode: (r.paystack_customer_code as string | null) ?? null,
      paystackSubscriptionCode: (r.paystack_subscription_code as string | null) ?? null,
      paystackEmailToken: (r.paystack_email_token as string | null) ?? null,
      paystackAuthorizationCode: (r.paystack_authorization_code as string | null) ?? null,
      nextPaymentDate: toIso(r.next_payment_date),
      graceUntil: toIso(r.grace_until),
      lastEvent: (r.last_event as string | null) ?? null,
      lastEventAt: toIso(r.last_event_at),
      ownerEmail: (r.owner_email as string | null) ?? null,
      manualPauseOrdered: r.manual_pause_ordered === true,
    };
  }

  // Owner alerts schema (Nov 3, 2026), self-applied like
  // pending_subscriptions so a billing deploy never fails on a
  // database whose schema.sql has not been re-run yet. The same DDL
  // also lives in menu-template/schema.sql for fresh setups.
  private alertsReady: Promise<void> | null = null;
  private ensureAlerts(): Promise<void> {
    if (!this.alertsReady) {
      this.alertsReady = (async () => {
        await this.sql.query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_email text", []);
        await this.sql.query(
          `CREATE TABLE IF NOT EXISTS notifications (
             id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
             slug text REFERENCES restaurants(slug) ON DELETE SET NULL,
             kind text NOT NULL,
             cycle_key text NOT NULL,
             channel text NOT NULL DEFAULT 'email',
             recipient text,
             subject text NOT NULL,
             body text NOT NULL DEFAULT '',
             status text NOT NULL,
             provider_id text,
             detail text,
             created_at timestamptz NOT NULL DEFAULT now(),
             UNIQUE (slug, kind, cycle_key)
           )`,
          [],
        );
      })();
    }
    return this.alertsReady;
  }

  async recordNotification(rec: NotificationRecord): Promise<boolean> {
    await this.ensureAlerts();
    const out = await this.sql.query(
      `INSERT INTO notifications (slug, kind, cycle_key, recipient, subject, body, status, provider_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug, kind, cycle_key) DO NOTHING
       RETURNING id`,
      [rec.slug, rec.kind, rec.cycleKey, rec.recipient, rec.subject, rec.body, rec.status, rec.providerId, rec.detail],
    );
    return out.length > 0;
  }

  async hasNotification(slug: string, kind: string, cycleKey: string): Promise<boolean> {
    await this.ensureAlerts();
    const found = await this.sql.query(
      "SELECT 1 FROM notifications WHERE slug = $1 AND kind = $2 AND cycle_key = $3 LIMIT 1",
      [slug, kind, cycleKey],
    );
    return found.length > 0;
  }

  async listAlertCandidates(): Promise<AlertCandidate[]> {
    await this.ensureAlerts();
    const found = await this.sql.query(
      `SELECT slug, state, billing_mode, next_payment_date, grace_until, owner_email, paystack_subscription_code
       FROM restaurants WHERE billing_mode = 'monthly' AND state IN ('live', 'grace')`,
      [],
    );
    return (found as Record<string, unknown>[]).map(r => ({
      slug: String(r.slug),
      state: String(r.state),
      billingMode: (r.billing_mode === "one_time" ? "one_time" : "monthly") as "monthly" | "one_time",
      nextPaymentDate: toIso(r.next_payment_date),
      graceUntil: toIso(r.grace_until),
      ownerEmail: (r.owner_email as string | null) ?? null,
      paystackSubscriptionCode: (r.paystack_subscription_code as string | null) ?? null,
    }));
  }

  async upsertRestaurant(patch: Partial<RestaurantRow> & { slug: string }): Promise<void> {
    const entries = Object.entries(COLUMN_MAP).filter(
      ([field]) => (patch as Record<string, unknown>)[field] !== undefined,
    ) as [keyof RestaurantRow, string][];
    if (entries.length === 0) {
      await this.sql.query(
        "INSERT INTO restaurants (slug) VALUES ($1) ON CONFLICT (slug) DO NOTHING",
        [patch.slug],
      );
      return;
    }
    const columns = entries.map(([, col]) => col);
    const values: unknown[] = [patch.slug, ...entries.map(([field]) => (patch as Record<string, unknown>)[field] ?? null)];
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(", ");
    const updates = columns.map((col) => `${col} = EXCLUDED.${col}`).join(", ");
    await this.sql.query(
      `INSERT INTO restaurants (slug, ${columns.join(", ")}, updated_at)
       VALUES ($1, ${placeholders}, now())
       ON CONFLICT (slug) DO UPDATE SET ${updates}, updated_at = now()`,
      values,
    );
  }
}

let neonRegistry: RegistryStore | null = null;
export function getRegistry(): RegistryStore {
  const url = process.env.DATABASE_URL;
  if (!url) return inMemoryRegistry;
  if (!neonRegistry) neonRegistry = new NeonRegistryStore(url);
  return neonRegistry;
}
export function slugFromPayload(payload: any): string | null {
  return payload?.data?.metadata?.slug ?? payload?.data?.metadata?.restaurant_slug ?? payload?.data?.customer?.metadata?.slug ?? null;
}
