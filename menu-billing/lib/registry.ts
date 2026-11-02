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
  manualPauseOrdered?: boolean; // Evans orders a pause; honoured on subscription.disable
}
export interface RegistryStore {
  appendPaymentEvent(rec: PaymentEventRecord): Promise<void>;
  getRestaurant(slug: string): Promise<RestaurantRow | null>;
  upsertRestaurant(row: Partial<RestaurantRow> & { slug: string }): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store (local dev, DATABASE_URL unset)
// ---------------------------------------------------------------------------
const events: PaymentEventRecord[] = [];
const rows = new Map<string, RestaurantRow>();
export const inMemoryRegistry: RegistryStore = {
  async appendPaymentEvent(rec) { events.push(rec); console.log("[payment_events append]", rec.eventType, rec.slug); },
  async getRestaurant(slug) { return rows.get(slug) ?? null; },
  async upsertRestaurant(patch) {
    const prev = rows.get(patch.slug) ?? { slug: patch.slug, state: "awaiting_payment", billingMode: "monthly" as const, paystackCustomerCode: null, paystackSubscriptionCode: null, paystackEmailToken: null, paystackAuthorizationCode: null, nextPaymentDate: null, graceUntil: null, lastEvent: null, lastEventAt: null };
    rows.set(patch.slug, { ...prev, ...patch } as RestaurantRow);
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
  manualPauseOrdered: "manual_pause_ordered",
};

class NeonRegistryStore implements RegistryStore {
  private sql: NeonQueryFunction<false, false>;
  constructor(databaseUrl: string) { this.sql = neon(databaseUrl); }

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
    const found = await this.sql.query(
      `SELECT slug, state, billing_mode, paystack_customer_code, paystack_subscription_code,
              paystack_email_token, paystack_authorization_code, next_payment_date,
              grace_until, last_event, last_event_at, manual_pause_ordered
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
      manualPauseOrdered: r.manual_pause_ordered === true,
    };
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
