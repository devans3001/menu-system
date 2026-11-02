# Menu Page Product: Integration Wiring Guide

Purpose: plug real (test-mode) credentials into menu-template and menu-billing and run the full billing and photo test sequence end to end. Everything below assumes TEST mode everywhere. No live keys, no live charges.

## What is wired and what is still stubbed (as of Nov 2, 2026)

Wired in code, waiting only for env values:

- menu-billing verifies Paystack webhook signatures (HMAC-SHA512 on the raw body) and maps events to registry states in `lib/event-map.ts`.
- menu-billing writes to Neon when `DATABASE_URL` is set: payment events append to `payment_events`, restaurant state upserts into `restaurants` (see `lib/registry.ts`). With no `DATABASE_URL` it falls back to an in-memory store.
- menu-template reads the restaurant billing state from the same Neon `restaurants` table when `DATABASE_URL` is set (`lib/db/registry-status.ts`), so the guest page shows the menu when live or in grace, and the holding page when paused or churned. With no `DATABASE_URL` it falls back to the demo state in `restaurant.config.ts`. A grace row whose `grace_until` has passed reads as paused on the guest page.
- menu-template menu documents read from the Neon `menus` jsonb row when one exists, seed document otherwise. Saves through `/api/menu` PUT upsert into `menus`.
- The editor Upload photo button uploads to Cloudinary with an UNSIGNED preset (`lib/upload/cloudinary.ts`) and stores the graded delivery URL in the photo field.

Still stubbed, do not mistake for working:

- Editor sign-in is demo mode. No magic-link email is sent yet.
- Editor edits live in browser state. The editor UI does not call `/api/menu` PUT yet, so edits do not persist to Neon from the screen.
- The Cloudinary storage meter is a placeholder percentage. A live reading needs the Cloudinary Admin API (API key + secret, server-side) and comes later.
- There is no background job that flips grace to paused in the database. menu-billing writes `paused` on `subscription.disable` after grace ends or on a manual pause order, and the template read treats an expired grace as paused in the meantime.

## Environment variables

### menu-billing (`.env.local` in `menu-billing/`)

| Variable | Where the value comes from |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Evans's own Paystack account, TEST mode. Paystack dashboard > Settings > API Keys & Webhooks > Secret Key (starts `sk_test_`). Hand over through the Secure Vault capture page, never through chat. |
| `DATABASE_URL` | Neon console > project > Connection string (pooled). Evans creates the Neon account and project. Same database menu-template uses. Run `menu-template/schema.sql` in the Neon SQL editor before testing. |

### menu-template (`.env.local` in `menu-template/`)

| Variable | Where the value comes from |
| --- | --- |
| `DATABASE_URL` | The exact same Neon connection string as menu-billing. Server-side only. |
| `MENU_DATA_SOURCE` | Optional. Leave unset: `DATABASE_URL` being set selects Neon automatically. `local` forces the seed/demo layer. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard home, cloud name. Evans's own Cloudinary account for testing; in production this is the client's own account, created on the client's domain email. Public by design. |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary console > Settings > Upload > Upload presets > create one UNSIGNED preset (signing mode: Unsigned). Name it, for example `menu_editor_uploads`. Public by design for unsigned uploads. |

No other secrets exist in this product yet. Cloudinary API key and secret are NOT used by either project at this stage.

## One-time setup before the test sequence

1. Neon: create the project, open the SQL editor, run all of `menu-template/schema.sql`. Confirm the three tables exist: `restaurants`, `menus`, `payment_events`.
2. Seed a registry row for the demo restaurant (slug must match `restaurant.config.ts`, currently `ember-palm-kitchen`):

   ```sql
   INSERT INTO restaurants (slug, state, billing_mode)
   VALUES ('ember-palm-kitchen', 'awaiting_payment', 'monthly')
   ON CONFLICT (slug) DO NOTHING;
   ```

3. Paystack (test mode): create the monthly plan (NGN 10,000 monthly) and a subscription page on that plan. Set the webhook URL under Settings > API Keys & Webhooks to the menu-billing address plus `/api/webhooks/paystack`. For a local run, menu-billing is not publicly reachable, so expose it with a tunnel (for example a Cloudflare or ngrok tunnel to the dev port) or use a deployed preview URL. Every charge must carry metadata so the webhook can find the restaurant: `slug` = `ember-palm-kitchen` and `billing_mode` = `monthly` (on a subscription page, set this in the page metadata; on an API-initialised transaction, pass it in `metadata`).
4. Cloudinary: create the unsigned upload preset named above.
5. Write the env files for both projects from the tables above, then start both apps: menu-billing with `npm run dev`, menu-template with `npm run dev` (add `-p 3107` if you want the usual local port). Open the template home page: with the registry row at `awaiting_payment` the menu still renders (only `paused` and `churned` hold the page).

## End-to-end test sequence

Run in order. After each step, check the `restaurants` row and the `payment_events` log in the Neon SQL editor: every webhook must appear in `payment_events` exactly once, in arrival order.

1. **Subscribe (monthly, success).** Open the Paystack subscription page and subscribe with Paystack's documented successful test card. Expected: webhooks `subscription.create` then `charge.success` arrive, signature checks pass (HTTP 200 from menu-billing), the row flips to `state = live` with `next_payment_date` set, and the template home page serves the menu.
2. **Failed charge (grace, menu stays live).** Trigger a failed renewal for the subscription: use a Paystack test card documented to fail or be declined in place of the saved card, or send the `invoice.payment_failed` test event from the Paystack dashboard webhook panel (label it in your notes as simulated if you use the panel). Expected: the row flips to `state = grace`, `grace_until` is about 7 days out, and the template home page STILL serves the menu. That is the product rule: a failed payment never takes the menu down during grace.
3. **Disable inside grace (pause deferred).** Cancel or disable the subscription in the Paystack dashboard so `subscription.disable` fires while grace is still running. Expected: the row stays `grace`. Then, to see the pause land without waiting 7 days, run `UPDATE restaurants SET grace_until = now() - interval '1 minute' WHERE slug = 'ember-palm-kitchen';` and reload the template home page. Expected: the holding page (menu temporarily unavailable).
4. **Manual pause path.** Set `manual_pause_ordered = true` on the row, reset state to `grace` with a future `grace_until`, and send `subscription.disable` again (dashboard cancel on a fresh subscription, or the dashboard test event). Expected: the row flips straight to `paused` despite the open grace window, because Evans ordered the pause.
5. **One-time payment (lifetime flip).** Create a Paystack one-time payment page for the one-time price (NGN 150,000) whose metadata carries `slug` = `ember-palm-kitchen` and `billing_mode` = `one_time`. Set the row's `billing_mode` to `one_time` first (the row is the source of truth for mode). Pay with the successful test card. Expected: a single `charge.success` webhook flips the row to `state = lifetime`, `next_payment_date` and `grace_until` cleared, and the template serves the menu with no subscription involved.
6. **Cloudinary upload.** With the two `NEXT_PUBLIC_CLOUDINARY_*` values set, restart menu-template, open `/admin`, continue in demo mode, and use Upload photo on any item with a real food photo. Expected: the photo field fills with a `res.cloudinary.com` delivery URL carrying the grade transform (`e_improve:100,e_sharpen:70`), the thumbnail updates, and the guest flip and list views show the uploaded photo. The storage meter percentage does NOT move: it is still the placeholder (see stubs above).
7. **Fallback check.** Stop both apps, remove `DATABASE_URL` from both env files, restart. Expected: menu-billing logs events to its in-memory store, menu-template serves the seed menu driven by `restaurant.config.ts`. Nothing errors. This proves local dev still works with zero credentials.

## Pass criteria

- All seven steps behave as expected, with `payment_events` matching the Paystack dashboard event history.
- No 401s from the webhook after the secret key is set (a 401 means the key in menu-billing does not match the Paystack account sending the events).
- No real money moved: Paystack stays in test mode for the whole session.
