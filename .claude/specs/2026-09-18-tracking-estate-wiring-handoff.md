# Wiring the tracking estate into the backend dashboard — handoff

**Date:** 2026-09-18 · **Repo:** `~/vending-website` · **Branch:** `main` @ `b8800fd`
**Three sessions landed today.** This file is the single map of what exists, who
owns which number, what is verified, and what is not yet safe to quote.

Paste this whole file into a fresh session. It is self-contained.

---

## 0. The instrument boundary — the most important section

Four systems now observe this funnel. They measure different populations with
different instruments, and **they are not supposed to agree**. Most reporting
bugs from here on will be somebody dividing one by another.

| Instrument                                         | Owns                                     | Never use it for               |
| -------------------------------------------------- | ---------------------------------------- | ------------------------------ |
| **GA4** (`ga4_page_views`, `channel_daily.visits`) | Sessions, landing pages                  | Anything post-submit           |
| **Our DB** (`lead_submissions`, `channel_daily`)   | Leads, qualification                     | Pre-submit behaviour           |
| **Close** (`close_lead_funnel`)                    | Booked, showed, won, revenue             | Traffic, channel mix           |
| **PostHog** (project 616762)                       | Pre-submit browser behaviour only        | Lead counts, bookings, revenue |
| **GSC** (not wired yet)                            | Impressions + clicks on the results page | Anything after the click       |
| **Platforms** (Metricool, YouTube, Bitly)          | Impressions, clicks                      | Site conversion                |

**Hard boundaries, agreed across all three sessions:**

- `resolveChannel()` in `src/lib/analytics/channel.ts` is the **only** channel
  definition. PostHog carries raw `utm_source`, never a channel name.
- `canonicalFunnelPath()` in `src/lib/analytics/canonical-path.ts` is the **only**
  path-folding function, re-exported from `funnel-monthly.ts` and imported by
  `event-context.ts`. Never write a second copy.
- **Never quote PostHog `form_submitted` as a lead count.** Leads are rows in
  `lead_submissions`. PostHog is pre-submit only.
- **No PostHog reads in `/admin/analytics`.** If a pre-submit view is ever wanted
  there, it is a server-side HogQL read joined on `vp_session_id`.
- **Close UTM fields are not channel mix.** The pending backfill will stamp
  `internal-webinar` and `manychat` onto thousands of leads. That is correct for
  Close and meaningless as a channel report.
- `vp_session_id` is the seam. It is on every PostHog event and on every lead's
  `metadata.attribution_session`. It is the only honest join between browser
  behaviour and outcomes.

**The four standing rules that keep a number honest:**

1. **Never turn missing into zero.** A denominator of 0 returns `null`, rendered
   as a dash. `0.0%` means observed-and-zero.
2. **Both sides of a division must be the same population, same instrument.**
   Cross-instrument rates are marked `crossSystem`, greyed, and dropped above 100%.
3. **Lead cohort, not calendar month.** A row's month is the month the LEAD
   arrived; their booking, call and sale count there whenever they happened.
4. **Clip to the days both instruments covered.** `visitsEnd` (GA4 lags ~1 day)
   and `visitsStart` (`LEADS_LIVE_FROM = 2026-07-27`, the cutover).

---

## 1. THE GATE — CLEARED 2026-09-18. The sync was double-counting.

**Settled without the manual exports**: the GA4 service-account key in
`.env.local` reads the same Data API the UI reads, so `scripts/ga4-reconcile.mjs`
asks GA4 the Traffic-acquisition and Landing-page questions directly. Re-run it
any time a number is disputed.

Measured 2026-09-11 → 09-17:

| Instrument                                    | Sessions  |
| --------------------------------------------- | --------- |
| GA4 Data API, no dimensions (ground truth)    | **3,141** |
| GA4 Landing page                              | 3,231     |
| GA4 asked with the sync's own four dimensions | 3,284     |
| Ours, `ga4_page_views`, before the repair     | **4,867** |

**Root cause.** GA4 keeps moving a session between dimension keys for about two
days after its day ends — one that first reports as `(not set)/(not set)` on a
blank landing page later resolves to `google` / `VP | Brand` on `/about`. Both
syncs upserted the settled key and left the provisional one in place, so the
same sessions were counted under two keys. 333 of our 1,045 rows for that week
were keys GA4 no longer reports, carrying the entire 1,591-session gap. 09-17,
the only day pulled once, matched (552 vs 560).

**Both of Adam's hypotheses were wrong, and that is the useful part.** Channel
grouping is not the gap — it explains only the Referral 107-vs-31 row and the
Direct/Unassigned split, which are definitional and expected per section 0.
Internal-traffic filtering is not the gap either: our sync reads the same API,
so the property's data filters already apply to it.

**Fixed and live** (`bcb9abb`): `ga4_page_views` purges rows in the pulled range
that the run did not rewrite, skipped entirely if a chunk failed.
`channel_daily` cannot key on `synced_at` — three connectors share the row and
each write bumps it — so the GA4 connector clears only the metric columns whose
own write landed, to null rather than zero.

**Repaired**: `scripts/ga4-repair-superseded.mjs` removed 376 rows carrying
1,820 sessions from September. `ga4_page_views` now equals the GA4 four-
dimension report exactly, and page views equal GA4's own total exactly.

**The residual 1–2% is GA4 disagreeing with itself** across grains: its
four-dimension report sums to 3,284 where its no-dimension total is 3,141,
because that many dimensions crosses the cardinality threshold and GA4 folds
rows into `(other)`. Any export at that grain shows the same. Do not chase it.

**Blast radius: September only.** The one-shot historical backfill wrote each
key once. Feb–Jun reconcile at −3.4%, July −1.5%, August +0.8%.

| Month     | Opt-in before | Opt-in after |
| --------- | ------------- | ------------ |
| July      | 5.21%         | **5.21%**    |
| August    | 5.09%         | **5.09%**    |
| September | 3.97%         | **4.47%**    |

September was understated by half a point. **The trend is still a decline**,
5.21 → 5.09 → 4.47, just a shallower one, and September is not a complete month.

**Still outstanding:** `channel_daily.visits` reads 3,441 against GA4's 3,141
for that week. The code fix is live but only self-heals its 3-day window, so
2026-09-11..15 need a day-by-day repair — day by day because a wider GA4 report
folds rows into `(other)`, and clearing against a folded key set would null
visits that are real.

## 2. What is live and verified

**Shipped to production today, `main` @ `b8800fd`, 2,637 tests green.**

- **Link coverage** — `/admin/links/coverage`. Production: **9 of 396 tagged
  leads** arrived on a link in `marketing_links`. YouTube (158 leads), Google Ads
  (122), Instagram (63) are all at **0%**. 70 distinct untracked links carry 387
  leads. Never infers a destination from the landing page.
- **Funnels tab** — all nine metrics at once, deselectable, channel marks on
  every channel row.
- **PostHog** — live on every public page, off on `/admin`, same-origin proxy at
  `/api/ph`. Dashboard "Website funnels (pre-submit)"
  (`us.posthog.com/project/616762/dashboard/2112148`), 7 tiles, weekly alert.
- **Rate honesty** — `ofObservedPct` replaced `pairedPct` everywhere.

**Three defects found and fixed today, each by running a report against live
production and reading the output critically — none by a test:**

| Defect                                         | Was                                 | Is                                                                 |
| ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| July divided 5 days of leads by 31 days of GA4 | opt-in 0.97%, "4x improvement"      | **5.21%**, and the real trend is 5.21 → 5.09 → 3.97, a **decline** |
| Journeys loader never selected `utm_campaign`  | Google Ads **0 visits** vs 96 leads | **4,716 visits**                                                   |
| `pairedPct` dropped non-converting days        | Webinar Book % **140%**             | **0.2%**                                                           |

**A fourth was investigated and dismissed:** `ghl_form` leads going to zero after
2026-08-25 is correct. Every such row is the GHL Waitlist Form, whose last
submission was 2026-08-25. Verified against the GHL API: 438 submissions owed for
September, 438 written. **Do not back-fill.**

---

## 3. What is NOT verified — say so out loud

- **The GA4 reconciliation above.** The gate.
- **`ga4-visits`'s "9 rows failed to write" is SOLVED, not fixed**: it is the
  `thankyou_visits` upsert. The column is in the generated types but was never
  added to production, so migration `20260912110000_channel_daily_thankyou_visits.sql`
  needs applying. The Supabase CLI in this checkout is not linked, so it needs
  Adam's database password. Until then the GA4 connector deliberately declines
  to clear that column, because clearing a column it could not write would
  erase a number nothing was going to replace.
- **`manychat-ingest` is stale: 167 hours, 2 rows.** Instagram DM is a live
  channel. Dead webhook or genuine silence — unconfirmed.
- **Only August 2026 is a complete month** of lead history. July is the clipped
  cutover month; September is in flight.
- **Nobody has eyeballed the Channels, KPI, Funnel map or Booked calls tabs**
  since `ofObservedPct` changed Book % and Win % on every surface that reads
  `channel-report-rollup.ts`.
- **GSC is not wired at all.** Adam's console shows **70 pages indexed, 289 not
  indexed** — ~19% of the site is in Google's index, against 2,215 search clicks
  in three months. That is a real finding and a real ceiling on organic, but it
  is an SEO story, not a funnel story. When wired, GSC belongs in the reach bands
  (`REACH_STAGES`, "Seen"/"Clicked"), never in the site funnel.

---

## 4. The work, in order

### A. Clear the gate (section 1). DONE 2026-09-18.

### B. The executive rollup — DONE 2026-09-18, `/admin/analytics?tab=exec`

Built as `funnel-executive.ts` + `FunnelExecutivePanel.tsx`. It owns no funnel
arithmetic: `buildFunnelMonthly` runs twice over one read, grouped by channel
and by page. `MIN_WEIGHT`, `FLAT_BAND` and `trendTone` are imported from
`FunnelMonthlyPanel.tsx`, not restated.

Cost per lead is the only number added, and it is clipped to the days the month
could capture a lead — July otherwise divided a whole month of spend by five
days of leads and read $474 against August's $101. It reads $53. Spend is
observed for Google Ads, Meta Ads and Webinar only; every other channel's cost
per lead is a dash. Months from before lead capture existed are left out rather
than shown as rows of dashes.

The original ask, for reference:

One view, one row per month, most recent first. Not per channel, not per page —
those are the drill-down and already exist.

- Columns: Visits · Leads · Opt-in % · Booked · Book % · Showed · Show % · Won ·
  Revenue · Cost per lead.
- Under it, the same months by channel and by page, collapsed by default.
- Month-over-month change per cell using the existing colour rules
  (`MIN_WEIGHT` 8 observations, `FLAT_BAND` 5%) — import from
  `FunnelMonthlyPanel.tsx`, do not redefine.
- **Reuse `funnel-monthly.ts`. Do not write a third rollup.**
- Rule 3 is not negotiable: a September sale from a July lead counts in July.

### C. Finish the Webinar naming

A Webinar lead **is** a registration (Adam, 2026-09-18). The lane's step was
relabelled to `/start form`, but the Journeys tab lays every lane against a
**fixed band axis**, and that column is still headed `LEAD` showing 3 — next to
Registered showing 4,036. The rename never reached the reader. See `bandOf()` and
`JOURNEY_BANDS` in `channel-journeys-report.ts`.

### D. Classify every dash on the Journeys tab

Not "fewer dashes" — every dash needs a reason a non-technical reader accepts,
and no dash may hide a bug. A dash meaning _our tagging is broken_ and one
meaning _this step does not exist in this funnel_ must not look identical.

Known: Instagram Qualified — (social landers skip the quiz, **correct**);
Chatbot Visited — (leads arrive mid-conversation, **correct**); YouTube Clicked —
(no click connector, **correct**); Instagram 2.5M impressions → 144 visits
(**the Meta tagging gap**, see F); Internal Ltf and Trustpilot claimed by no lane.

### E. Reconcile every headline to its source

Leads → count `lead_submissions` directly. Booked/Showed/Won/Revenue → Close.
Visits → GA4. Registrations → the webinar receiver. Write it to
`docs/marketing/` as a dated file with real numbers. **If a number cannot be
reconciled, say so in the doc rather than quietly shipping it.**

### F. Blocked on people

- **Meta campaign naming.** Meta ad links need `utm_medium=paid_social` and a
  campaign distinguishable from organic. Only **1** lead in 30 days carries
  `instagram/paid_social`; 116 carry `google/cpc`. **Do not ship the code first**
  — it would relabel organic Instagram as paid, which is worse than the gap.
- **The link registry.** One row. Owners: Kody (site/paid), Mike and Anthony
  (social + newsletter), Stephen (Close/outbound). Until filled,
  `channel_daily.destination` is `unknown` on ~99% of rows.
- **Setter links put the destination in the campaign slot** —
  `mike-ig/setter/book-call` (52 leads) has `book-call` as `utm_campaign`, not
  `utm_term`. Tagging fix, not a code fix.
- **Close custom fields** — five text fields on Leads (`utm_source`,
  `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`). Two minutes in the
  Close UI. The backfill is written and dry-run validated.
- **`CLOSE_MATURITY_DAYS = 30` / `SHOW_GRACE_DAYS = 1`** are invented and gate
  Win % everywhere. Dom or Adam must set them.
- **Was the GHL Waitlist Form retired on purpose?** Last submission 2026-08-25.

---

## 5. What to tell the CEO this week

**Send the infrastructure story, not the numbers.** The estate is real and
defensible today; one visit-count question is not yet closed, and every
conversion rate divides by it.

What is true and worth showing:

- Four instruments wired onto one session seam (`vp_session_id`), each owning
  exactly the metrics it can actually observe.
- Every marketing link now has a standard and a registry, plus a live report
  naming which links are missing from it.
- Funnels are cohort-correct: a sale counts in the month the lead arrived.
- The dashboard refuses to print a number it cannot defend — a dash means _not
  observed_, never zero, and a rate that cannot be true is suppressed rather
  than shown.
- Three real defects were caught and fixed this week **before** anyone quoted
  them, including one that had the headline trend pointing the wrong way.

That last point is the story. The system caught itself.

---

## 6. Repo gotchas

- **npm, not pnpm.** `pnpm exec` / `npx` trigger a failing install. Use
  `./node_modules/.bin/{tsc,vitest,eslint,next,prettier}`. `pnpm-lock.yaml` and
  `pnpm-workspace.yaml` at the root are not ours — leave them untracked.
- **A push to `main` publishes to www.vendingpreneurs.com in ~1 minute.** No
  staging.
- **Admin login blocks localhost.** Every `/admin/*` path 307s to login whether
  or not the route exists, so a 307 proves nothing about a deploy.
- **`curl` returns a ~600-byte shell** — pages stream through a root
  `loading.tsx` Suspense boundary.
- **Routing is load-bearing for PostHog.** Keep `curl -I /about/` = 308 → `/about`
  and `POST /api/ph/e/` = 200.
- **posthog-js drops every capture from headless Chromium** (bot detection on UA,
  userAgentData, `navigator.webdriver`) while config and flags still fire — so
  the proxy looks alive while nothing is recorded. Use
  `scripts/ph-preview-check.mjs`.
- **A node script importing app modules** must load `.env.local` into
  `process.env` BEFORE the import and alias `server-only` to
  `vitest.server-only-shim.ts`. `jiti` is the only TS runner installed.
- **Other sessions edit this checkout.** Re-check `git status` immediately before
  staging; stage files explicitly. Today one session held an uncommitted
  `scripts/backfill-close-lead-utms.mjs` — merge rather than rebase so their work
  is not stashed.
- **`viewer-access.ts` + `viewer-access.test.ts` are a deliberate pair.** A new
  admin page must be added to both lists or the guard test fails.
- **`rtk` mangles output** with parens or alternation, and mangles `git diff`.
  Use `/usr/bin/{grep,git,head}`. `/usr/bin/cat` does not exist; use `/bin/cat`.
- **`thankyou_visits`** is in the generated DB types but not in production; a
  query selecting it 400s.

## Verification standard

`./node_modules/.bin/tsc --noEmit`, `vitest run`, `next build`, `eslint src`.
Then run the changed report against **live production data** and read the output
critically. Every real defect found today came from that, none from a test.
Production is readable with `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` over PostgREST, `Range` header to page past 1,000.

One pre-existing lint error in `src/lib/booking/post-booking-redirect.ts` (an
eslint rule name that no longer exists) is unrelated.

**Baseline: 2,637 tests passing, types clean, build green.**
