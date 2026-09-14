# Funnel map — live conversion tracking, handoff 2026-09-14

Continues `2026-09-14-funnel-map-handoff.md`. Goal: the admin funnel map shows
real, trustworthy conversion data end to end — click-through, visit-to-lead,
lead-to-booked, show rate, close rate — so the marketing team can read it and
find the leaks. The Funnelytics idea, on our own data.

**Status: not shareable.** Four commits local, nothing pushed, and the gaps in
§4 are what stand between here and showing it to anyone.

## 1. What shipped (local commits, `main`, not pushed)

| commit    | what                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| `6a0420e` | dedupe leads by `lead_id` before upsert in `close-lead-funnel-sync`          |
| `2773b1c` | `funnel-cohort.ts` + `funnel-forecast.ts` + cohort wired into `getFunnelMap` |
| `5a07bee` | conversion pills on the map                                                  |
| `394256b` | delete `FunnelRail` (a strip under the map — wrong, see §5)                  |
| `9358644` | **vertical relayout** of `funnel-map-graph.ts` + comprehensive layout test   |
| `1b941e4` | pill was 3 lines and spilled out of its own box; now 2 lines + clip          |
| `901b128` | cohort counted 0 wins when nothing was mature; count and rate split          |

Suite green at 2,440. tsc and eslint clean.

### New modules

- **`src/lib/services/funnel-cohort.ts`** — pure. Anchors on
  `first_sales_call_booked_date`, joins outcomes back to it. Returns booked,
  showable, held, noShow, pendingShow, showUnlogged, closeable, won,
  wonOfCloseable, showPct, closePct, coverage, maturity status. Never returns
  zero for unknown.
- **`src/lib/services/funnel-forecast.ts`** — pure, tested, **currently dead**
  (only its type is imported). `project`, `delta`, `sensitivity`,
  `biggestLeak`. See §4.4.
- **`src/components/admin/funnel-map-graph.test.ts`** — layout guard. Box vs
  box, pill vs everything, label vs box, dashed regions contain their members.

## 2. The bug this fixes

The map divided stages summed over the same calendar days. A call booked in
June and won in September put its win in September's numerator over
September's denominator — the ratio of two unrelated groups of people who
happened to share a month. Jess's spec bans exactly this for SteelTrap
(`~/Desktop/funnelytics prompt.md`, §2 and §7 "Critical prohibition"); we had
it too.

Fixed by reading `close_lead_funnel` cohort-wise. Visits and leads still come
from `channel_daily` — a visit and its lead share a day, so that side was
never wrong.

## 3. Data facts established against production (2026-09-14)

**`first_sales_call_booked_date` is the date the call is SCHEDULED FOR, not
the date it was booked.** 46 rows dated after today, latest 2026-09-24. It
reproduces the call-capacity dashboard's "New Meetings Booked" exactly:
today 9/14 = 24, matching the screenshot. The code comments and the sentence
printed under the map both say "the day the call was booked". **Wrong. Fix the
wording** — the arithmetic is fine, show-maturity measured from a scheduled
date is more correct than what was documented.

- `close_lead_funnel`: **8,230 rows**, was never empty. The previous handoff's
  "writes 0 rows every run" was stale or intermittent.
- A full crawl is 42 pages / 8,229 leads with **zero duplicates**. The dedupe
  in `6a0420e` is a correct guard against a cursor-walk race but **the original
  `ON CONFLICT` failure was never reproduced**. Do not claim it is fixed.
- Sync runs clean: 8,229 written, no error.
- Outcome coverage **75%** (6,183 of 8,229 carry a show-up answer). The "37%"
  in older notes was the lead table, not Close.

### Last 30 days, cohort vs calendar

|        | calendar (old) | cohort (new) |
| ------ | -------------- | ------------ |
| booked | 636            | 613          |
| showed | 296            | 308          |
| won    | 34             | 37           |

568 mature, 308 held, 260 no-show, 24 too new, **21 had their call and nobody
logged it** — so the 54.2% show rate is an upper bound.

### Daily numbers (for the Goals page ask)

Calls scheduled per day, by funnel, reproduces the capacity dash. Today 24:
Reactivation Scrapers 7, Instagram 6, Internal Webinar 4, Website 2,
Google Ads 2, YouTube 2, LinkedIn 1. Lane 1 22 / Lane 2 2.
Forward: 9/15 = 21, 9/16 = 12, 9/17 = 8.

### RESOLVED: "booked today" does have a source

`calendly_bookings.raw_payload -> payload.created_at` is **Calendly's own
booking timestamp** — when the invitee actually scheduled. Use it, not the
`created_at` column, which is our row-insert time (it showed 1,899 "created"
today from a backfill).

Two different numbers, both real, do not conflate them:

- **calls on a day's calendar** — `close_lead_funnel.first_sales_call_booked_date`.
  Today 24. Answers "who are the closers talking to today".
- **calls booked on a day** — Calendly `payload.created_at`. Today 34, landing
  9/14:2, 9/15:13, 9/16:7, 9/17:5, 9/18:3, 9/19:1, 9/24:1, 10/02:1, 10/06:1.
  Answers "what did marketing produce today". This is the pace number.

Recent booked-on volume: 9/08 90, 9/09 48, 9/10 45, 9/11 44, 9/12 26,
9/13 11, 9/14 34.

`channel_daily.booked` is dated by this same Calendly timestamp and broadly
agrees (9/08: 87 vs 90). It reads low intraday only because the connector has
not re-synced — stale, not wrong. For a live "booked today" figure either
trigger the sync or read `calendly_bookings` directly.

**Attribution on booked-on is weak: 26 of today's 34 carry no `utm_source`**
(google 3, youtube 2, chatbot 1, 2 junk). So volume is trustworthy, channel
split is not. That is a Calendly UTM capture gap, not a reporting bug — worth
fixing before the Goals page shows booked-by-channel per day.

Coincidence to avoid: the capacity dashboard's "Total Meetings Booked 34" for
today is 24 new + 7 follow-ups + 3 reschedules **scheduled today**. It is not
the same 34.

## 4. What is missing — the actual work

### 4.1 Click-through rate is not on the map at all

The spine starts at `visits`. `channel_daily` carries `impressions` and
`clicks`, and `REACH_STAGES` already models them, but there is no reach or
clicks node and no CTR pill. Add a clicks→visits step. Note the caveat in
`channel-report-rollup.ts`: Seen and Clicked cover different channel sets, so
they are not clean stages of the site funnel — decide how to present that
honestly rather than dividing two populations (the same class of bug as §2).

### 4.2 Close rate is not on the map

`CONVERSION_PINS` has three entries; `from` stages are visits, leads, booked.
No showed→won pill. Adding one is trivial; making it mean something is not —
see §6.1.

### 4.3 Revenue is unavailable everywhere

Close deal value is not mirrored. `channel_daily.revenue` exists but is dated
by when money landed, which reintroduces §2 one row lower. To make revenue
real, mirror Close opportunity value onto `close_lead_funnel` (there is already
`earliestWonDate` + opportunity handling in `close-booking-reconcile.ts` to
copy from).

### 4.4 The forecast layer is dead code

`funnel-forecast.ts` is committed and tested; nothing calls it. It went away
with the rail. Jess's spec §5 View 2 and Funnelytics' whole pitch are the
forecast layer. Either wire it onto the map (pills showing `31.7% vs ~38%`,
an Actual/Forecast/Change toggle) or delete the module. Do not leave it.

### 4.5 Never verified in the real admin

Every check so far was a standalone `renderToStaticMarkup` preview. **This has
burned us twice** — see §7. Push to a branch, open
`/admin/analytics?tab=map` in a real preview deploy, and look at it before
telling anyone it works.

### 4.6 Not responsive

Canvas is fixed 1040×2240 inside `overflow-x-auto`. On a phone it is a pan.
Adam's standing rule is responsive. Decide: vertical stack at narrow widths,
or accept desktop-only and say so on the page.

### 4.7 Per-channel conversion

Source boxes show "N leads · N booked" but no rates. The team's question is
"which channel converts", and the map does not answer it yet.

## 5. Decided — do not relitigate

- **No strip under the map.** A separate rail duplicating the map in a worse
  form was built and deleted. The numbers belong on the map.
- **Vertical, top to bottom.** Left to right, the gaps between spine boxes were
  68px and a readable pill is 176 wide; every pill landed on a box. Vertical is
  what makes the numbers fit.
- **Red/green is ranked against the other steps**, not a benchmark. There is no
  honest fixed threshold for a good conversion rate.
- **Never turn missing into zero.** This was violated twice already (§1
  `901b128`). Every rate is null when its denominator is empty or immature.
- Post-sale (Mighty Networks, VendHub) stays one dashed unmeasured box.

## 6. Open decisions — need Adam or Dom, block real numbers

1. **Close-maturity window.** `CLOSE_MATURITY_DAYS = 30` in `funnel-cohort.ts`
   is invented. At a 30-day range nothing is ever mature, so the close rate is
   permanently unavailable at the range people actually use. Needs a real
   number. `SHOW_GRACE_DAYS = 1` likewise.
2. **Capacity source.** To show "17 booked vs 29 open slots" on the Goals page,
   open-slot and per-day-goal (42) data must come from somewhere. Not in this
   database. Candidates: Stephen's `call-capacity-dashboard` repo, SteelTrap
   Lakebase, Calendly availability API.
3. **"Booked today" — RESOLVED, see §3.** Both numbers exist and mean
   different things. Decide which belongs on the Goals page (probably
   booked-on, for pace) and label it so nobody reads it as the other. The
   dashboard's 34 adds follow-ups and reschedules; our mirror is
   first-calls-only by design and cannot produce that.
4. **Revenue basis** — observed won value, a planning AOV, or both labelled
   separately (Jess's spec §14 q4).

## 7. Traps that already cost time

- **Standalone previews lie.** The layout test hardcoded the pill as 84×48
  while the component drew it wider; text wrapped to four lines and three pills
  sat on boxes while the suite was green. Separately, the preview CSS was built
  without source scanning, so none of the pill's `text-[0.5625rem]` classes
  existed and everything rendered at default size. Build preview CSS with
  `@import "tailwindcss" source("<repo>/src")` **from inside the repo**, and
  import real dimensions into tests from the module the component reads.
- **`rtk` mangles redirects and some greps.** Use `/usr/bin/grep`,
  `/usr/bin/git`, `/usr/bin/awk` for anything whose output you reason on.
- **This repo is npm, not pnpm.** `pnpm exec` / `npx` trigger a pnpm install
  that fails. Run `./node_modules/.bin/vitest`, `./node_modules/.bin/tsc`.
  Stray `pnpm-lock.yaml` / `pnpm-workspace.yaml` at the root are not ours.
- **The credential guard blocks** reading `.env.local` values, copying secrets
  between projects, and `vercel env pull`. Ask Adam rather than working around.
- Admin login blocks localhost, so the only real check is a preview deploy.

## 8. Immediate next steps, in order

1. Fix the scheduled-vs-booked wording in `funnel-cohort.ts` (`MATURITY_RULE`,
   the `Cohort` doc comment) and in `funnel-map.ts` `actualsBasis`.
2. Push the four commits to a branch; open a preview deploy; **look at the map
   in the real admin** at desktop and phone width.
3. Add the clicks→visits (CTR) pill, handling the different-channel-coverage
   caveat honestly.
4. Get the close-maturity window from Adam/Dom, then add the showed→won pill.
5. Decide the forecast layer: wire it on, or delete `funnel-forecast.ts`.
6. Per-channel conversion rates on the source boxes.

## 9. Housekeeping

- **Rotate `CLOSE_API_KEY`.** `api_5lK5…` was pasted into chat on 2026-09-14
  and is in `~/vending-website/.env.local` line 75 and Vercel production. Mint
  a replacement in Close → Settings → API Keys and update both.
- `~/ma-internal-platform/.env.local`'s `CLOSE_API_KEY` is a 2-character
  placeholder, not a key. Do not use it.
- Release freeze was still on as of this writing. Nothing pushed.
- Previews on Adam's Desktop: `funnel-map-preview.html` (live data),
  `brands/` copied beside it so logos resolve.
