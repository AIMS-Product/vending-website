# Booking funnel rebuild — handoff

**Date:** 2026-09-17
**Repo:** `~/vending-website` · branch `main` (clean, pushed, deployed)
**Shipped:** `69ff27a`, `3796564`, `0fa1d9d` — all live on `www.vendingpreneurs.com`

## What the funnels are now

Eight booking pages, all rendering one shared hero + one shared form component:

| Route                                                                                                                                       | What it is                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/contact`                                                                                                                                  | Scored qualification funnel. The only page with the orange submit.   |
| `/book-now`                                                                                                                                 | Same funnel, scoring stage dropped, straight to the setter calendar. |
| `/booking-youtube`, `/booking-meta`, `/booking-internal-ltf`, `/booking-partner`, `/booking-passivepreneurs`, `/booking-reactivation-email` | `/contact` clones. Identical flow; only `source_path` differs.       |
| `/booking-t5-socials`, `/booking-ak-t5`                                                                                                     | Social-ad landers, simplified form, Mike / Anthony personas.         |

Everything about them keys off **one list**: `src/lib/content/booking-funnel-routes.ts`
(`BOOKING_FUNNEL_PATHS` / `isBookingFunnelPath`). That list drives three separate rules —
no header, no footer, no chatbot teaser, plus UTM preservation on links pointing at them.
Adding a funnel route means adding it to its registry; everything else follows.

Registries that feed it:

- `src/lib/content/contact-clone-pages.ts` — `CONTACT_CLONE_SLUGS`
- `src/lib/content/booking-pages.ts` — `bookingPages` (social landers)
- `src/lib/content/funnel-redirects.ts` — `FUNNEL_REDIRECTS` (retired URLs)

## What changed today

1. **Hero is two columns.** Copy left, form right, on the first screen. The form used to
   be a dark band below the video, so anyone who did not scroll never saw it. The form
   carries the `#apply-form` anchor, so every CTA scrolls back to one form.
2. **No header, no footer, no chatbot teaser** on the eight funnels. The chat launcher
   still renders; only the unprompted bubble is suppressed.
3. **Member stories play in place.** They used to open youtube.com in a new tab.
4. **Four channels could not book at all.** `/booking-internal-ltf`, `/booking-partner`,
   `/booking-passivepreneurs`, `/booking-reactivation-email` rendered the legacy page,
   which has no calendar: the form captured an email and sent them to
   `/thank-you-for-applying`. Now on the scored funnel.
5. **Eleven redirects** from the redirect sheet, in `next.config.ts`. Every destination
   carries `?source_path=` so a lead keeps the channel that sent it; the visitor's own
   UTMs pass through on top.
6. **Design pass:** Anton display face on the H1 (matching the home hero), blue highlight
   block on `$5-$60k/Month`, proof moved into the left column, smaller body copy,
   real member stories replacing the three static card graphics.

## Open decisions — need a human, not a code change

1. **`/start` conflicts across three sheets.** Sheet 2 says `/start` → redirect to
   `/book-my-advisory-call-accelerator`. Sheet 1 says webinar traffic goes _to_ `/start`
   and books there. The redirect sheet says accelerator → `/contact`. Following all three
   bounces webinar traffic twice and changes its calendar. **Left `/start` live and
   working** (legacy page, Calendly `cxwj-zxk-2z4/vending-route-advisory-call`).
   `start-vending.com` redirects to it with UTMs intact.

   **Resolved 2026-09-18 — Adam.** Sheet 1 wins: webinar traffic keeps landing on
   `/start` and books there on `cxwj-zxk-2z4`. Sheet 2's `/start` -> accelerator hop is
   dropped. The redirect sheet's accelerator -> `/contact` stands. No code change: both
   were already the shipped state. Verified in production 2026-09-18 —
   `/book-my-advisory-call-accelerator` 308s to
   `/contact?source_path=%2Fbook-my-advisory-call-accelerator`, `/start` returns 200,
   `start-vending.com` 302s to `/start` with its UTMs intact.

   What the accelerator page was: the old Webflow 45-minute Vending Accelerator advisory
   call, Calendly `cxv9-jg6-m53/vending-accelerator-call` (row 46 of Kody's migration
   sheet). It was never rebuilt here — it exists only as the redirect above.

2. **Unscored ad traffic outranks scored leads for top-closer time.** Reframed
   2026-09-17 after Adam pushed back — the first write-up asked "which calendar did
   these URLs lose", which is the wrong question. The real one:

   - The scoring bands are literally named `lane_1` and `top_closers`
     (`BAND_THANK_YOU`, `src/lib/qualification/scoring.ts`). `top_closers` (85–100)
     → `cvr6-cfd-zgd`; `lane_1` (65–84) → `cxfn-hh2-h8g`.
   - Both social landers capture name/email/phone with **no scoring at all** and hand
     off to `cvr6-cfd-zgd` — the top-closer calendar. Post-consolidation, eight social
     URLs feed it.
   - So a three-field ad click reaches the top closers; a scored `lane_1` lead does not.
   - Capacity runs the same way. Playwright against both Calendly grids, 2026-09-17:
     `cvr6-cfd-zgd` **4 open days** in the next five weeks, `cxfn-hh2-h8g` **1**.
     `booking.ts:18` records `cxfn-hh2-h8g` showing every day unavailable for five
     weeks as of 2026-08-27 — why the chatbot was moved off it.
   - Not only the landers. Five legacy pages still book a calendar with no scoring in
     front of them, all 200 today: `/book-my-advisory-call-l1-topcl` (top closers),
     `/book-my-advisory-call-l1`, `/book-my-advisory-call-setter`, `/booking-ig`,
     `/start`.

   **Resolved 2026-09-17 — `b5af976`, live.** Adam: the round robin is already
   weighted to favour the top closers, so everything pointing at it is correct; the
   invariant is that a booked call lands on a closers' calendar. That inverts the
   finding. Nobody was reaching the wrong people — `booking.ts:56` says the same seven
   closers sit behind all three Lane 1 links. The `lane_1` band was being handed a
   calendar it could not book.

   Fix: `LANE_1_CALENDLY_URL` now defaults to `cvr6-cfd-zgd`. Each band keeps its own
   constant and `NEXT_PUBLIC_*` override, so strong fit can still be repointed without
   moving perfect fit — changing the mapping key instead would have left
   `NEXT_PUBLIC_LANE_1_CALENDLY_URL` dead config that reads as live.

   Proof: rendered all four bands on the built app and on production after deploy.
   `strong_fit` is the only row that changes; `not_right_time`, `good_potential`,
   `perfect_fit`, both social landers and `/book-now` are byte-identical.

   **Held back deliberately:** `/book-my-advisory-call-l1` books the same starved
   calendar, but it is a row in Kody's live migration sheet
   (`docs/migration/vendingpreneurs-migration-sheet.csv`). Diverging from the client's
   source of truth is his call. Four more pages book a calendar with no scoring in
   front of them: `/book-my-advisory-call-l1-topcl`, `/book-my-advisory-call-setter`,
   `/booking-ig` (a fifth calendar, `dv5d-5zj-g8b`, nothing else uses) and `/start`.
   All five are ruling two on Kody's page.

   Note: `docs/migration/conversion-pages.md` documents a
   `scripts/diff-conversion-sheet.mjs` drift checker. That script does not exist in the
   repo.

## Next up

- ~~**Seal the pages after the form.**~~ **Done — `92c62a0`, live.** `/thank-you` (all
  four fit states), `/thank-you-for-applying` and `/qualify/[sessionToken]` now render
  bare. `POST_CONVERSION_PATHS` + `isFunnelChromePath` sit alongside
  `BOOKING_FUNNEL_PATHS` in the same file rather than inside it: that list also drives
  UTM preservation on links pointing at a route, and these are redirect targets, so
  folding them in would claim them as ad destinations. Header, Footer and the chatbot
  teaser key off the chrome predicate; attribution still keys off the funnel list.
  `/qualify` dropped its `data-hide-site-*` attributes — one mechanism, not two.
- ~~**Rebuild the Kody approval page.**~~ **Done — same URL, version 2.**
  <https://claude.ai/artifact/22tydXwm7u6m7htKDWmM2g> was updated in place rather than
  replaced, so any link already shared stops being wrong. Covers all ten funnel routes,
  the post-form surfaces, all eleven redirects, the design pass, and the three rulings
  (income claims on ad destinations, the b5→t5 calendar consolidation, the rewritten
  hero supporting line). Still private until shared from the page's share menu.
- **Watch booking volume** against the same weekdays before reading anything into it.
  Form placement, closed exits, the removed hero CTA, and the calendar consolidation all
  moved at once.
- **CMS still offers a centred hero.** The page-builder `hero` block has a `compact`
  variant that centres. Left alone deliberately — it is an editor choice behind a design
  contract in `docs/design/page-builder-blocks.md`.

## Gotchas hit today — will cost time if rediscovered

- **`pnpm dev` fails** in this repo (`ERR_PNPM_IGNORED_BUILDS`). Use
  `./node_modules/.bin/next dev -p <port>` directly.
- **curl against a page returns a ~600-byte shell**, not the content — pages stream
  through the root `loading.tsx` Suspense boundary. Use Playwright to assert on rendered
  DOM. curl is still correct for headers and redirects.
- **`next start` restarts race.** Kill by port (`lsof -ti:PORT | xargs kill -9`) or the
  old process keeps serving a stale build and every measurement lies.
- **rtk mangles greps** containing parens or alternation — they silently return zero.
  Use `/usr/bin/grep` for anything whose output you reason about.
- **`next/font` is a build-time transform vitest does not apply.** Faces are shimmed via
  `vitest.next-font-shim.ts`, aliased in `vitest.config.ts`. One export per face the app
  loads; adding a face without adding it there fails loudly.
- **Inline backgrounds paint over neighbouring lines below `line-height: 1`.** The H1
  highlight needs its leading floor kept at or above 1.
- **Vidalytics autoplays muted.** Correct on `/pre-call-resources` (visitor already
  booked), wrong on a funnel. Players there mount on click.
- **A real route shadows its `[legacyLeadPath]` entry, and a `next.config` redirect
  shadows both.** Leftovers are dead config that reads as live. Both guards are asserted
  in `legacy-routes.test.ts` and `funnel-redirects.test.ts` — do not delete them.
- **Another session edits this checkout.** CAC tracker files appeared mid-run today.
  Always re-check `git status` immediately before staging.
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` are untracked and pre-existing. Not yours.

## Verification standard used

`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run` (2,558 tests / 301
files), `./node_modules/.bin/next build`, `./node_modules/.bin/eslint src` (14 warnings,
all pre-existing). Then Playwright against the live domain, not just the build — that is
what actually proved the chrome and chatbot suppression.
