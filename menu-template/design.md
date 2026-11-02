# Demo Skin Design: Ember Palm Kitchen (fictional demo instance)

This is a fictional demo instance for engine development. It is not a client build.

## Gate 1: Brief before code (v2, Nov 2, 2026)

V1 (Playfair Display on dark brown, Claro gold, empty photo stage) was rejected by Evans in one word. V2 is a ground-up skin rebuild. Business logic, data model, editor functions and billing did not change. Appearance only.

Reference anchors:
- Dishoom: poster-led world building. Match the pacing and the poster type, a restaurant told as printed posters from its own world, not as web cards.
- Pizzeria Beddia: process photography. Food and craft fill the frame, tight crops, nothing sits small in a box.
- Awwwards restaurant sites with monumental condensed type: the dish name devours the page, quiet small text is the rhythm around it.

Named extreme direction: MIDNIGHT GRILL POSTER. A Lagos grill house told as a cinematic night-market poster.

One-sentence spine: Fire, smoke and ink: every dish is a poster from one charcoal night.

Inventory only this venue has (fictional): charcoal as the kitchen heart, swallow paired by hand (soup times protein), a happy hour at the bar rail, a family platter built for the table, palm wine in a calabash glass.

## Tokens

Palette:
- bg: #0D0A07 (near-black warm charcoal)
- surface: #171008
- ink: #F7EFE3 (cream)
- accent: #FF5C1F (flame, the ONE sharp accent: price, action, active states)
- accent2: #E3A90A (gold, spent only on specials: THE GOLD LEAF strip, special prices, gloss)

No navy, no purple-blue gradients, no Claro palette borrowing.

Type (loaded via next/font/google in app/layout.tsx):
- Display: Anton, monumental caps, tight, scale jumps of 3x and more (22px wordmark, 40px+ dish names, clamp to 21vw on the FIRST BITE poster).
- Serif voice: Cormorant Garamond italic for dish descriptions and poetry lines.
- Body and UI: Manrope.
- Numbers and labels: Space Mono.

Texture and structure: subtle CSS grain overlay on dark panels, hairline rules in cream at 14 percent instead of card walls, sharp poster corners, photos full-bleed and overlapping type elements (the price pill sits on the photo edge).

Layout variant: flip-first. Guest lands on THE FIRST BITE poster, then THE FLIP poster card, with a fast list toggle always visible.

Demo photos: hotlinked from Unsplash (the same photos judged in the v2 and v3 screenshot audits, where local copies under public/demo were used so the sandbox browser could render them). Production per-client images live on the client's own Cloudinary account and pass through THE GRADE (lib/engine/photo-grade.ts plus the .photo-grade render finish in globals.css).

Motion rules: One signature moment (THE FIRST BITE poster settle with a thin progress line). Everything else quiet: THE FLIP is a GSAP fold, the outgoing sheet folding from its spine edge over the incoming page (already rendered beneath) with a shadow sweep and a 0.985 settle on the incoming page, 580ms on a custom ease (fast lift, soft land, no bounce), category jumps riffle through two partial folds first, swipe and arrow keys turn too, photos preloaded two pages either side, and reduced motion swaps the fold for a 200ms crossfade. Honest scope note: the homework's literal 16-frame photoreal page-curl sequence is a photographed engine asset that does not exist yet; this GSAP fold is the engine until that asset is shot or generated. THE 86 desaturate 600ms with a rotated Sold Out stamp, THE GOLD LEAF gloss once per special per session, THE STEAM only on hot-flagged dishes. Reduced motion disables all but state changes.

Reading sizes (print-menu practice, tuned Nov 2): dish description Cormorant italic 19px at line-height 1.5, variant and modifier rows 15px, per-size price lines 13px, no reading text under 13px on the guest view, Anton dish names with letter-spacing opened to 0.025em so the caps breathe.

## Bans replaced, by name

- 3-equal-card grids: replaced by one poster card per dish and editorial list rows.
- Centred-everything: replaced by left-aligned poster type, right-aligned mono prices, edge bleed photos.
- Uniform rounded corners: sharp poster corners, pills only where a pill means action or price.
- Gradient text, glassmorphism, emoji icons, fade-up everywhere: none present. The only gradient is the photographic scrim at the bottom of the FIRST BITE poster.
- Playfair and the safe serif median: replaced by Anton plus Cormorant italic, chosen for this brand, not inherited.

## Audit notes (Gate 3)

Run per build: screenshots at 375 and 1440 in ~/workspace/menu-page-product/verification (firstbite-mobile, flip-mobile, flip-desktop, list-mobile, admin-signin-mobile, admin-editor-mobile) with JS-measured overflow and photo naturalWidth checks. Remaining tells are recorded honestly in BUILD_LOG.md after each run.
