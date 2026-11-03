-- Neon Postgres schema for the Menu Page Product registry.
-- One Neon project holds every restaurant. Menu is a jsonb document.
-- State enum and slug rules per homework Section 2b.

CREATE TYPE restaurant_state AS ENUM (
  'prospect', 'awaiting_payment', 'building', 'live', 'grace', 'paused', 'lifetime', 'churned'
);
CREATE TYPE billing_mode AS ENUM ('monthly', 'one_time');

CREATE TABLE IF NOT EXISTS restaurants (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 63),
  state restaurant_state NOT NULL DEFAULT 'prospect',
  billing_mode billing_mode NOT NULL DEFAULT 'monthly',
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  paystack_authorization_code text,
  manual_pause_ordered boolean NOT NULL DEFAULT false,
  next_payment_date timestamptz,
  grace_until timestamptz,
  last_event text,
  last_event_at timestamptz,
  cloudinary_usage_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- For databases created from an earlier version of this schema.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS manual_pause_ordered boolean NOT NULL DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_email text;

-- Owner alerts (Nov 3, 2026): every alert the billing service sends
-- or records lives here. The (slug, kind, cycle_key) triple dedupes
-- per billing cycle: a webhook retry or a repeat daily scan never
-- sends the same alert twice, while a new cycle alerts again.
-- Statuses: sent, recorded (no email provider configured yet),
-- failed, no_recipient. The billing service also self-creates this
-- table on first use, so a deploy never waits on a schema re-run.
CREATE TABLE IF NOT EXISTS notifications (
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
);

CREATE TABLE IF NOT EXISTS menus (
  slug text PRIMARY KEY REFERENCES restaurants(slug) ON DELETE CASCADE
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  menu jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- Append-only webhook log. Never update or delete rows here.
CREATE TABLE IF NOT EXISTS payment_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text REFERENCES restaurants(slug) ON DELETE SET NULL,
  event_type text NOT NULL,
  paystack_reference text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_slug_idx ON payment_events(slug, received_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_type_idx ON payment_events(event_type, received_at DESC);

-- Subscriptions that arrived before their menu could be identified.
-- Paystack's subscription.create has no metadata slug, so the billing
-- service parks it here keyed by customer code and links it into the
-- restaurants row when the matching charge.success lands (Nov 3, 2026).
CREATE TABLE IF NOT EXISTS pending_subscriptions (
  customer_code text PRIMARY KEY,
  subscription_code text,
  email_token text,
  next_payment_date timestamptz,
  plan_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
