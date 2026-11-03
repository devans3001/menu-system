# Menu Page Product — seed brief (Oct 29, 2026)

Evans's concept, in his words: given the number of small to medium restaurants out there, create a reusable menu page that we duplicate. Not a SaaS, more of duplicate, and charge monthly for it. Something very peculiar to each business, with mouth-watering animation. The platform allows the user to update it, with a limit, which comes with an increase in monthly fee.

## The model
- One shared menu engine (layout system, motion system, editor), duplicated per restaurant.
- Each instance skinned to be peculiar to that business: palette, type, imagery, and one signature dish animation (the Cactus THE LONG TABLE and Linh Anh THE POUR builds are the proof this studio can make food move).
- Monthly fee per restaurant. No big build fee, or a small setup fee; decide in this chat.
- Owners update their own menu (items, prices, photos, sold-out toggles, specials) up to a monthly edit limit. Higher limit tiers cost more per month. The limit is what stops the product becoming unpaid support work.
- The menu page is the link in the restaurant's Instagram bio, Google profile, and on a table QR code.

## Guardrails agreed in the seed discussion
- The editor stays TINY: items, prices, photos, availability, specials. No ordering, no payments, no accounts dashboard. Ordering is a later paid upsell (the plant-nursery build is the ordering-tier proof), never v1 scope creep.
- The editor includes a FREE QR code download (Evans, Oct 29, 2026): the owner can download their menu QR from the admin panel in print-ready form and print it themselves, no charge, no asking us. Muse still produces the first QR at delivery (per the runbook); after that it is self-serve.
- Shared engine, unique skin. Evans's design law (no two builds share a grammar; reference anchor, named direction, one-sentence spine; photoreal imagery, never code-drawn food) applies to the visible layer of every instance, or the product drifts into generic QR-menu territory and competes with free tools.
- Month-to-month, cancel anytime (restaurant churn is real). Value must be visible: it is their bio link, not a page nobody opens.
- Never describe the work as "simple". No em dashes in public copy.

## Why now
- The Oct 29, 2026 re-filtered grind lists hold 86 verified billing prospects (43 Canada, 43 Nigeria), restaurants prominent among them: The Moonroom and On Rice (Ottawa), Hugo Café (Ottawa), Kingfisher Africa (Lekki, flagged "no menu site"), plus Cactus Restaurant already holding a full free build. The menu page is a smaller first yes than a full website and can upsell into one.

## Decisions added by Evans, Oct 29, 2026 (evening)

- ONE build for all countries. There are not two country versions of the template or the system; price varies by country behind the one system, the product does not fork.
- Duplication workflow: we ask the client for a fixed set of business information (intake), Muse duplicates the master build and updates the instance from that intake, then returns the master to a clean slate for the next client. The intake list itself is a deliverable of this chat.
- Money shape: the client pays for their DOMAIN upfront (registered in the client's name, per Evans's standing practice), then the monthly fee. No monthly fee starts before the domain is theirs.
- Images: Cloudinary, one account per client, created with an email address on the domain we buy for them (ops order: domain, then domain email, then Cloudinary, then assets). Accounts live in the client's name, matching Evans's nursery pattern for SMS and database.
- Payments: Paystack is the rail (see the payment structure below). The system must know who has paid WITHOUT Evans checking manually: subscription state drives the instance.

## Payment structure (Muse's design, for Evans to approve in this chat)

- Paystack Plans per tier per market (Nigeria in NGN, Canada priced in CAD terms but charged via Paystack), one Subscription per client restaurant.
- Clients pay by card once; Paystack tokenises and bills monthly automatically. Nigeria clients can also use Paystack direct debit.
- Webhooks are the source of truth: charge success keeps the instance live. Nobody checks a dashboard to see who paid. CORRECTION (homework, Oct 29, 2026): Paystack does NOT retry failed subscription charges.
- FAILED PAYMENT FLOW (Evans, Oct 29, 2026, supersedes the auto-pause design): on invoice.payment_failed the system emails the client (with the update-card link) and the menu STAYS LIVE. Muse runs a billing check every Monday 09:00 WAT and gives Evans a non-payer list (restaurant, amount, failure date, days overdue). Evans personally messages the non-payers. If they refuse to pay, Evans orders the pause: every instance has a manual off-switch, and a successful payment webhook restores it automatically. Evans just needs to know who is not paying; the judgement calls stay his.
- CANADA CURRENCY (Evans, Oct 29, 2026): Canada is billed in USD on Paystack (Paystack cannot charge CAD, and a whole country is not lost over it). The Canada plan is created in USD at the equivalent of his CAD prices, about $22/mo and about $322 one-time at Oct 2026 rates; exact USD figures are fixed when the plans are created.
- Verified Oct 26, 2026: international cards can pay a Nigerian Paystack business (3.9% + ₦100), settled in NGN by default, so Canadian restaurants CAN be billed on the same rail. Caveats: a minority of foreign banks block recurring foreign debits, and NGN settlement means the CAD price floats with the rate. Fallback for Canadian clients whose cards will not recur: a single annual prepay charge (one authorisation, twelve months covered).
- Evans never touches card data; Paystack hosts and tokenises, webhooks are signature-verified.

## Pricing model (revised by Evans, Oct 29, 2026, evening: NO TIERS)

Evans killed the tier grid. There is ONE offer. The client chooses how to pay for it:

- Monthly: one flat monthly fee via Paystack subscription (webhook-driven live/paused state, as designed above).
- One-time: a single payment and we never bill them monthly again. Proposed anchor for the product chat to settle: 12 to 15 times the monthly price. What still recurs for a one-time client is only their own costs: domain renewal yearly and their Cloudinary account, both in their name.

Single-price discussion anchors (to settle in the product chat): Nigeria ₦20,000/mo, Canada $45/mo, World $39/mo, each plus domain at cost and a launch setup fee upfront. Reference point: OddMenu charges $10/mo for a generic self-serve template; this product is done-for-you, uniquely skinned, and opens with a cinematic moment, so it prices above them on purpose.

## The limit is their Cloudinary (Evans, Oct 29, 2026)

There is no edit-count limit. Text and price edits are unlimited. The scarce resource is media, and the cap is the client's own Cloudinary account (free tier: 25GB plus bandwidth credits). The editor meters their usage via the Cloudinary API, shows them the meter, warns around 80 percent, and blocks new photo uploads at the cap until they delete media or upgrade their own Cloudinary plan with their own card. Evans's cost stays zero and the limit is a fact of their account, not a rule he has to police. Images are optimised on upload (around 150KB each, per the nursery build practice), so 25GB is genuinely roomy for a menu.

## THE FLIP (Evans, Oct 29, 2026)

The menu itself opens as a flip book. At the first instance of the menu, dishes are presented one page at a time, and moving to another dish plays a flip book animation: photoreal frame sequences (the same frame-scrub craft as THE POUR and THE GLASS PASS) turn like pages, dish to dish. Browsing the menu should feel like flipping through something physical and appetising, not scrolling a list. The full list/grid can exist behind it for guests in a hurry, but the flip is the face of the menu.

## Billing mode structure (Evans, Oct 29, 2026)

Every client record carries one billing flag, monthly or one-time, and the structure must make switching trivial:

- Monthly: a Paystack subscription exists. Webhooks drive live, grace, paused.
- One-time: NO subscription is ever created. Evans creates a Paystack payment link covering the one-time fee and the domain purchase. When he receives the Paystack alert or confirmation, Claro takes the brand's details, builds and registers the instance as lifetime, and hands ownership over. Nothing bills again. Later updates are hourly paid work. (Clarified by Evans, Nov 3, 2026: one-time onboarding is deliberately concierge and manual; the longer automated sequence belongs to monthly billing.)
- Switch: a monthly client who later chooses one-time is handled manually by Evans: the existing subscription is disabled and confirmed first, then the one-time process above is followed, so there is no double billing or leftover subscription.

## Pricing DECIDED by Evans (Oct 29, 2026, evening)

One price per band. Setup = Evans's Domain + Launch Setup bundle (₦35k Nigeria incl. domain year 1; Canada cut from $95 to $50 CAD by Evans on Nov 1, 2026, because $95 was too high for Canadian clients; the $50 is MENU PRODUCT ONLY, the Canada website Domain + Launch Setup bundle stays at $95 CAD, per Evans's word the same day; world at the same pattern plus domain at cost):

- Nigeria: ₦10,000/mo, or ₦150,000 one-time.
- Canada: $30 CAD/mo, or $450 CAD one-time.
- Rest of world: $15/mo, or $300 one-time.

The maths: one Nigeria one-time client is ₦185,000 in hand (₦35k setup + ₦150k). Ten Nigeria monthly clients are ₦100,000 every month; twenty are ₦200,000. One Canada one-time client is $500 in hand ($50 setup + $450). Evans deliberately priced monthly near OddMenu's level while done-for-you, and set the one-time at 15 to 20 times monthly.

## World prospect search (ordered Oct 29, 2026; reminder set for Mon Nov 2, 10:00 WAT)

Evans will instruct a worldwide search for menu-product prospects: restaurants with NO menu (no digital menu, no menu on a website) that are ACTIVE (posted within roughly 30 days), verified live like the Oct 29 re-filters, delivered as a DM list.

## Differentiation vs OddMenu (checked live Oct 29, 2026)

OddMenu (oddmenu.com) is the competitor Evans met in person at a restaurant in Lagos: a QR menu SaaS at $10/mo (cheaper billed 6 or 12 months ahead), free first month, unlimited items and photos, remote editing, staff access, multi-language, hide-item and old/new price features. It is one template for everyone: the restaurant pours its content into the same design as every other customer, self-serve.

This product differs on three things:
1. Done for you, not DIY: intake in, finished page out.
2. A skin that is peculiar to each restaurant (palette, type, imagery), never the same page twice.
3. THE FIRST BITE: when a guest scans the QR, before the menu appears, a 3 to 5 second cinematic moment plays: the restaurant's own signature dish in photoreal motion (steam, a pour, a sizzle), with their name in their type. Then the menu. OddMenu opens on a list; this opens on appetite.

## First work in this chat
1. Decide the editor mechanism (keep it non-SaaS: per-instance structured menu data plus a tiny edit surface) and the edit-limit tiers.
2. Draft Nigeria and Canada monthly price points (anchor: Evans's Canada care plans are $49/$99/$179; Nigeria changes run ₦10k/hr; the nursery deal is ₦400k one-off by contrast).
3. Design the template system under the captivating_web_design skill: one engine, a skin system, and the signature dish motion system.
4. Pick ONE pilot restaurant (warm lead first: Cactus if they reply; otherwise a top grind target) and define what the pilot must prove (price accepted, owner can self-edit, support time per month).
5. Name the product.

Nothing gets built or pitched until Evans approves the shape in this chat. Evans's standing rules apply: show first, push only on his say-so.

## Homework outcome (Oct 29, 2026; full report: ~/workspace/research_notes/menu-platform-homework-20261029/report.md)

- Code structure: one private `menu-template` Next.js repo (engine, editor, skin system, no client data ever); duplicating clones it into a per-client repo holding a committed `restaurant.config.ts`, while the menu and billing state live in the database so owner edits need no redeploy. One tiny central service (`menu-billing`) receives webhooks and flips instance state; no client-facing platform.
- Database: Neon Postgres (free tier first). It is the only candidate whose free tier can never hard-pause the billing registry: it scales to zero and wakes automatically on the next connection, while Atlas M0 pauses after 30 idle days (manual resume) and Supabase free pauses after 1 week. Menu-scale data cannot exhaust any of them, so Evans's MongoDB storage instinct was right but storage was never the deciding axis. Runner-up: MongoDB Atlas M0, if a pure-document stack is preferred plus a keep-alive ping.
- Paystack pattern: monthly = Plan + Subscription, startable from a dashboard-created Subscription Page link (no API needed to sell); one-time = dashboard Payment Page link, no subscription ever created, webhook flips the client to `lifetime`. Webhooks (HMAC-SHA512 on the raw body) are the source of truth for live/grace/paused, and the receiver needs only a small API surface (slug metadata, disable-on-switch, update-card links).
- Corrections to earlier assumptions in this brief: (1) Paystack does NOT retry a failed subscription charge, so the grace period is ours to build (proposed 7 days, menu stays live, then paused). (2) Paystack cannot charge CAD (currencies: NGN, USD, GHS, ZAR, KES, XOF), so Canada clients must actually be charged in USD or NGN; the "$30 CAD" price needs a charging decision from Evans.
- Open questions for Evans: Canada charging currency (USD plan vs NGN equivalent); grace length and what a paused menu page should say. RESOLVED Nov 1, 2026: the fallback subdomain question is closed, Evans decided "they have to renew": a client whose domain lapses loses the page until they renew. No fallback subdomain rescue is built. The delivery pack must state the yearly renewal duty in plain words.


## Domain registrar facts (checked Nov 1, 2026, at Evans's request)

- .com at cost, international registrars (USD): Cloudflare Registrar $10.46 register and renew (at cost); Porkbun $11.08, rising to about $11.81 with the Nov 1, 2026 .com wholesale increase; Namecheap $11.28 to $11.48 first year but renews at $18.48 to $18.68, so avoid Namecheap for client domains. At ~₦1,369/$ (Oct 31 rate), Porkbun/Cloudflare year 1 is about ₦14,300 to ₦16,200, inside the ₦20k domain allowance in the Nigeria ₦35k bundle. Registrar standard: Porkbun (Cloudflare as the alternative), so client renewals stay ~$11/yr instead of jumping.
- .com bought locally in Nigeria: WhoGoHost/GO54 promo ₦14,999 year 1 with ₦24,000 renewal; other local registrars ₦23,500 to ₦24,000 flat. Local renewal at ₦24k is the number to quote clients who buy locally.
- .ca (CAD): roughly $10 to $16 first year, renewals $15 to $21 (OVHcloud Canada $9.99 first year, $14.99 renewal; dotCanada $12.99, renewal $15.99; FullHost about $12.48). Comfortably inside the Canada $50 setup bundle (Evans cut it from $95 on Nov 1, 2026), leaving about $34 to $37 of launch setup after the domain. CIRA Canadian Presence Requirements apply: the registrant must be a qualifying Canadian presence, which works because the domain is registered in the Canadian client's own name; Evans cannot hold a .ca in his own name.

## Addendum (Oct 29, 2026, evening): animation set + owner runbook

Full text in the homework report (Sections 5 and 6 of ~/workspace/research_notes/menu-platform-homework-20261029/report.md).

- Animation set (the premium package, named pieces): THE FIRST BITE (per-restaurant 50-frame signature-dish moment on scan, the only per-client motion cost), THE FLIP (shared page-curl engine over the client's own dish photos), plus four shared supporting pieces: THE STEAM (ambient life on hot dishes), THE REVEAL (dish detail lift), THE 86 (sold-out transition), THE GOLD LEAF (specials gloss). Performance budget set for mid-range Android: poster-first under 1 second, menu usable under 1.2 MB, reduced-motion and low-data fallbacks for every piece.
- Owner runbook shape: Paystack plans are created once per band, never per client. Per client, Evans personally does the money and account steps (domain in the client's name, domain email, Cloudinary signup on that email, GitHub repo generated from the `menu-template` template as `menu-<slug>`, a `client-<slug>` branch in the one Neon platform project, sends the Paystack link, approves final visuals, sends the delivery pack): about 45 minutes of his hands on a first client, settling toward 30. Muse does everything else: duplication script, registry row, skin pass, FIRST BITE frames, menu load, billing wiring and proof, verification, QR. "Delivered" is a five-point definition (own domain live over HTTPS, editor login working, QR and link pack handed over, registry billing state correct, Evans's visual approval), not a deploy.

## Addendum (Nov 2, 2026): menu taxonomy research

Deep research commissioned by Evans before the build so the platform caters to every restaurant type: full report at ~/workspace/menu-page-product/research-menu-taxonomy.md (source notes in ~/workspace/research_notes/restaurant-menu-taxonomy-20261102-0713/).

Headline consequences for the data model and editor:
- Category, Item, Price is not enough. The model needs: several menus per venue with schedules and precedence (dayparts, weekend, date-bounded overlays); nestable sections; items reusable across menus with per-menu price overrides; variants; reusable modifier groups whose option prices can depend on the chosen variant (pizza toppings priced by size is the canonical case); bundles and set menus as slot compositions with choose-N and per-choice supplements; specials as a first-class scheduled price-rule overlay, never edited copies of items; availability (86) as a separate state from active with auto-return presets, staff-operable without price rights; per-person pricing tiers (buffets); allergen-contains and dietary-suitable-for as separate fields on every named entity; a per-menu tax_included flag plus free-text price note; wine fields (producer, vintage, glass/carafe/bottle prices).
- Nigerian shapes the model must carry natively: swallow equals choose soup times choose protein with paid extra meat/fish; shawarma variants encode composition (regular vs large is single vs double sausage, not volume); per-piece protein pricing.
- Editor tiers are in the report (Tier 0: reorder and duplicate, instant price edit on the same QR, one-tap 86 with auto-return, phone photo upload, variants, plain-language reusable modifier groups, currency and tax presets for Nigeria and Canada, draft/published with a guest preview as of a chosen day and time).
- Differentiator found: no sampled platform offers per-restaurant-type editor presets (Buka, Shawarma, Café and so on). That is the "peculiar to each business" promise expressed in the editor, not just the skin.
- Caveats carried from the research: OddMenu's own feature docs were not retrievable, so its matrix column rests on two disagreeing secondary sources and is low confidence; competitor prices were not live-verified and are not to be quoted externally; GloriaFood shuts down Apr 30, 2027, so it is a feature benchmark and a migration source, not a durable rival.
