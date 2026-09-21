# Reporting accuracy + attribution — handoff

**Date:** 2026-09-21 · **Repo:** vending-website · **All work below is merged to `main` and live.**

## Shipped this session

1. **Q4 goal plan is per month, not flat 800** (`channel-targets.ts`). +10%/month compounding from
   each channel's real August: Sep 619 / Oct 676 / Nov 740 / Dec 810, **Q4 2,226**. A quarter is the
   sum of its months. `team-report.ts` had the same `target × months` bug — fixed.
   **The workbook's 821 August baseline is NOT used and must not be encoded.** Its own Booked Call
   Summary tab says 523 for August and our mirror reproduces that exactly (Jun 602 v 603,
   Jul 676 v 677, Aug 523 v 523 — 1,801 of 1,803 leads). Nothing reproduces 821.
2. **Goals total counts plan channels only** — it was holding every booked call against a
   six-channel target and reading "ahead" on Meta/Google/LinkedIn (488 v 452). All-in figure is in
   `allBooked`, printed under the table.
3. **Week-to-date column**, Friday–Thursday, matching `weekStartOf` in `close-week-view.ts`.
4. **Calendly booked-at guard** (`withBookedAt` in `calendly-bookings.ts`). The chatbot embed
   confirmation stored a payload with no `payload.created_at`, so those calls were in no daily pace
   figure. 13 historical rows repaired by `scripts/repair-calendly-booked-at.mjs`; ledger now has
   zero undatable bookings.
5. **Setter credit reads the Close mirror** (`call-credit-data.ts`), not
   `lead_submissions.booked_by_setter` which only exists for site-form leads. Untagged 2,097 → 1,016:
   **1,081 bookings gained a named setter.**
6. **Calendly-vs-Close conflicts surfaced** (`creditConflict`). 12 live, marked "Close says <name>"
   per row and summarised on /admin/bookings.
7. **Closer credit on won deals** (`close-wins.ts`). Close always returned `user_name`; the request
   asked for `_fields` without it. 39 September wins, $274,712, every one attributed.

## Verified live (browser, logged in)

Goals page renders correctly: Plan channels **454 of 619, on pace**, expected 433, week from 9/18,
all-in 491, 4 with no funnel. "Other targets you may have seen" lists 800 / 833 / the 821 curve as
superseded. Bookings shows the conflict panel (12 calls) and per-row "Close says" badges.

## Open — next session

- **Admin pages are very slow.** /admin/goals ~60s+, /admin/channels **116–176s** to first render.
  Root cause not yet investigated; likely `getBookedPace` reading the whole `calendly_bookings`
  table plus the whole `close_lead_funnel` table on every request, and Channels additionally paging
  the Close API live. **This is the most CEO-visible problem left.** Suspect unindexed full-table
  paging; consider a materialised daily rollup or caching.
- **"Who closed them" table not visually confirmed.** The heading text is present on
  /admin/channels but DOM traversal did not pin the table rows before we ran out of context.
  Confirm it lists people with won/revenue.
- **Name normalisation.** "Ariella" (21 calls) and "Ariella Irvine" (2) are the same person in two
  rows. The biggest conflict group is Ariella / Vince Bartolini. One Calendly id
  (`24b6d4b6`) still renders as "Calendly user 24b6d4b6".
- **30 leads where Close contradicts itself**: `first_call_show_up = No` while `call_disposition`
  says a show and the deal is Closed/Won. Drags the show rate down. Decide: surface as a
  data-quality list, or verify against Avoma.
- **927 leads** whose funnel is Lane 2 but `sales_team_lane` says Lane 1. Daily pace excludes Lane 2
  **by funnel**. Confirm which field should govern.
- **Avoma**: API access already works. Key is in `~/attention-to-avoma/HANDOFF.md` **in plaintext —
  rotate into `AVOMA_API_KEY`**. Meetings carry `state` / `duration` / `transcript_ready`, which is
  the independent evidence for the 30 contradictions. **Coverage vs Close's first-call list is
  unmeasured** — measure before trusting it for reporting. Zero webhooks registered.
- **Still-open connector gaps**: `bitly_link_clicks` empty (blocks YouTube CTA attribution);
  Metricool reports 37–52 posts/day linking out without standard UTMs (blocks Instagram content
  attribution); `manychat_events` empty (Instagram DMs never landed).
- **Audit findings from the first stored run** (9 pass / 2 warn / 2 fail): no YouTube views stored
  for 2026-09-19; "2 of 135 leads never reached Close"; calls-on-calendar 3.5% above Calendly.

## Applied by Adam this session

`channel_daily.thankyou_visits` and `data_audit_runs`. GA4 now writes **216 rows, 0 failed**
(was 6 failing nightly). The nightly audit stores verdicts for the first time.
`cac_months` / `cac_routes` already existed — my earlier claim that the CAC tab was broken was wrong.
**/admin/cac was not confirmed rendering** (it did not finish loading within 30s); check it.

---

# Performance + information architecture — diagnosis and plan (2026-09-21)

## Measured, not guessed

Table sizes read per request: `close_lead_funnel` **8,365** · `calendly_bookings` **4,276** ·
`channel_daily` **32,720** · `lead_submissions` 1,139.

**The cause is sequential full-table paging on every page load.** Both
`fetchFunnels` (`booked-metrics-data.ts:217`) and `fetchCloseSetters`
(`call-credit-data.ts:243`) read `close_lead_funnel` with **no filter at all** — every one of the
8,365 rows — in a `for` loop that awaits one 1,000-row page at a time.

| Page              | Work before first paint                                                                                                                 | Observed     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `/admin/goals`    | 9 sequential pages of `close_lead_funnel` + 5 of `calendly_bookings` (with 2 JSON path extractions per row) ≈ **14 serial round trips** | 60s+         |
| `/admin/bookings` | the above plus 9 more pages for `fetchCloseSetters`                                                                                     | slow         |
| `/admin/channels` | up to **50 sequential Close API calls** (`MAX_PAGES` in `close-wins.ts`) plus the spine                                                 | **116–176s** |

`fetchCloseSetters` was added this session for setter credit. It fixed 1,081 miscredited bookings
and it made `/admin/bookings` slower. Both are true; the read needs bounding, not reverting.

## Fix order (highest value first)

1. **Parallelise the paging.** Read the exact count first, then issue every range request
   concurrently instead of awaiting each. Turns 9 serial trips into one wave. No semantic change,
   lowest risk, biggest single win. Applies to `fetchFunnels`, `fetchCloseSetters`, `fetchBookings`.
2. **Bound `fetchFunnels` by date — carefully.** It looks up a booking's funnel by email to exclude
   Lane 2. A naive `first_sales_call_booked_date` filter would drop leads whose first call sits
   outside the window and silently count them as non-Lane-2, corrupting the daily pace. Safer: key
   the lookup off the emails actually present in the booking window (`.in("email", …)` in chunks).
3. **Cache the Close API on `/admin/channels`.** 50 serial external calls cannot be made fast.
   Either persist won deals into a table on the existing cron and read that, or wrap in
   `unstable_cache` with a short TTL.
4. **Stream the page.** Wrap each panel in `<Suspense>` so the shell and the fast panels paint
   immediately instead of the whole route waiting on the slowest query.
5. **`channel_daily` is 32,720 rows** — check the read paths there next; same pattern likely.

## Information architecture — 41 admin routes

`find src/app/admin -name page.tsx` returns **41**. That is the "too many tabs" problem, measured.
Rough shape of the overlap, to be confirmed with Adam before any move:

- **Reporting surfaces that answer overlapping questions:** `goals`, `analytics`, `attribution`,
  `cac`, `bookings`, `team`, `links/coverage`, `chatbot/insights`. A CEO should not have to know
  which of eight tabs holds "how are we doing".
- **Content/CMS surfaces:** `pages`, `news`, `case-studies`, `media`, `libraries`, `popups`,
  `forms`, `links` — legitimately separate, but they sit in the same flat nav as reporting.
- **Settings scattered:** `settings`, `settings/routes`, `settings/users`, `pages/redirects`,
  `links/coverage`, `pages/block-preview-audit`.

**Do not restructure this unilaterally.** It is a product decision about who reads what. Next
session should open with the `brainstorming` skill, agree the grouping with Adam, and only then
move routes. The performance work above is independent of it and should go first.
