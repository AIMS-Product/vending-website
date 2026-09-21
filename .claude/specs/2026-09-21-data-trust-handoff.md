# Handoff — data trust, glossary on screen, audit coverage (2026-09-21, late)

Fourth session of the day. Everything below is pushed and live unless it says otherwise.

Read first: `REPORTING.md` at the repo root. It is the glossary and it is now also a
screen at `/admin/data`. Add to it as you learn; that is the point of the file.

## Shipped and live

- **Book %** folds in-room webinar CTA bookings. Webinar 0.7% → 3.6%. (`09716df`)
- **Overview tiles**: "Leads 109" became "Site form fills" + "Total captured". Verified
  against live data for Sept 14–20: 115 + 1,193 = 1,308, matching `REPORTING.md` §2. (`e732cca`)
- **Week picker + total row** on `/admin/analytics`. Whole Mon–Sun weeks only, current
  part-week excluded. Emits `custom:` range keys the page already parsed. (`9fe4be5`)
- **Spine drift fix** — `clearMovedBookingRows` in `channel-sync.ts`. (`5b8fe6d`)
- **`/admin/data`** — the glossary rendered from `REPORTING.md`, above it last night's
  source checks. Viewer-readable so Jess and Kody can open it. (`890ac57`, `9906266`)
- **`REPORTING.md` §9** — a standing register of every contested number. (`3559465`)

## The spine drift, root-caused

`channel_daily` is rebuilt by upsert and an upsert never deletes. When a booking's day
changes — a `booked_at` correction, a re-import, a date-bucketing fix — the sync writes it
at its new day and the row at the old day keeps its count. The rollup sums both.

Proven by exact arithmetic: `aug11_end_cta` sat correctly on Aug 11 and 12 (13 + 5) **and**
as a lump of 18 on Aug 24. Same for `aug18_end_cta` (9 + 1, and 10) and `aug25_end_cta`
(19 spread over Sep 8–11). Each duplicate equals that cohort's total exactly.

Measured: **34 rows, 90 phantom bookings** since June, all `leads=null`.

| Week | Spine reads | Phantom | True |
| ---- | ----------- | ------- | ---- |
| W8   | 164         | 56      | 108  |
| W9   | 112         | 0       | 112  |
| W10  | 128         | 32      | 96   |
| W11  | 81          | 1       | 80   |

Ruled out by measurement, not opinion: lead/Calendly double counting (3 of 1,122 estate-wide,
0 in W8/W9); twinned keys from the Sept 11 rename (0 — that migration worked); null
`booked_at` falling back to the import day (0 of 1,282); read truncation (both readers window
by day, cap 200,000, table is 32,720).

**Status: the fix is live but the data is not yet corrected.** The next `channel-sync` run
(cron `10 11 * * *`, 4:10am PT) clears 88 of the 90. Re-measure W8/W10/W11 against the table
above to confirm 164→108, 128→96, 81→80.

The two it will not reach, both single bookings on links with no surviving booking anywhere:

- `2026-07-22 instagram/simon/{{user_id}}/_____` — an unrendered link template that shipped
  live. A tracking bug in its own right; the booking is real, its attribution is not.
- `2026-09-15 chatbot/site_chat/(not set)/5b3714ca-…` — a dead chatbot session key.

Backup of all 34 rows before any change: `.claude/specs/orphan-booked-backup-2026-09-21.json`.

## Highest-value open item: the audit does not check bookings

`/api/admin/data-audit/run` (cron `30 12 * * *`) compares 7 numbers to an outside source:
GA4 visits ×2, Close first calls, Calendly bookings, ad spend, GHL form fills, YouTube views.
Plus 5 internal checks: Close mirror freshness, no campaign day counted twice, no day missing,
every lead reached Close, every connector ran cleanly.

**Not checked at all:**

- `channel_daily.booked` — the spine's booked count is compared to nothing. This is exactly
  why 90 phantom bookings survived since June with no alert. `spine-forked-spend` catches the
  identical defect in **spend** only.
- **Show rate** — no check exists.
- **Webinars** — `webinar-push` checks only that numbers are _arriving_, never that
  registrations / attendance / bookings match Zoom or the sheet.
- **Won and revenue** — no check.
- **Contacts / total captured** — no check.

Suggested next slice: add an orphan check to `spineChecks` in `data-audit-checks.ts`, modelled
on `spine-forked-spend`. An orphan is a `booked` row whose `synced_at` predates the newest sync
that covered its own day — valid only while that run did cover the day. It renders on
`/admin/data` for free, because that page lists whatever the audit stored.

## Next slice, as Adam framed it: mirror the MTD funnel with OUR numbers and OUR sources

Reproduce the shape of Stephen's MTD funnel dashboard — booked → showed → qualified →
closed-won — built entirely from our own Close mirror, so every stage can name its own
population and source instead of being quoted from his sheet.

**This is achievable without new ingestion.** `close_lead_funnel` already holds every field
it needs, synced hourly by `close-lead-funnel-sync.ts` (cron `5 * * * *`): First Sales Call
Booked Date, First Call Show Up (Opp), Qualified (Opp), Funnel Name DEAL (Opp), Todays Call
Disposition (Opp), Reactivation - Setter Name, Lead Source - Company, Marketing Source Type,
Sales Team Lane.

**Start from what exists.** `close-week-view.ts` already applies a week rule over that table
and renders at `/admin/analytics?tab=close`. The likely shape is a funnel view beside it, not
a new pipeline. Check before building.

**Stephen's exact Booked definition is written down** in `REPORTING.md` §5 — four filters,
including excluding four meeting owners. Note Spencer Reynolds is an active VP setter, so his
meetings are invisible in Stephen's dashboard; whether ours should drop them too is an open
decision for Adam, not a defect to fix silently (§10 question 2).

Known agreement, so the slice has a bar to clear: on matched Mon–Sun windows our Close mirror
tracks him within ~2% (W10 167 v 172, W11 163 v 166) and the marketing line matched exactly at
W10 (89 = 89). Reproduce that or explain the gap.

**Do not mirror his "Leads" column.** It read 365 for a week with 809 registrants and 1,965
for a week with 1,109. `REPORTING.md` §5 says so; the funnel's top stage needs our own
acquisition number (§2), not his.

**Deliverable that matches the point of this work:** each stage names its population and its
source on screen, and a disagreement with Stephen is shown rather than reconciled away —
the same rule `/admin/data` follows. Add each new number to `REPORTING.md` §9 as settled or
contested.

Tier-1: this feeds how the sales funnel is reported. Use `safe-feature-slice`.

## Rules that cost time today

- Measure through `fetchFacts`, never raw `channel_daily`.
- **`vitest.config.ts` pre-sets placeholder Supabase env vars** (`localhost:54321`). A temp
  diagnostic that loads `.env.local` with `??=` silently reads nothing and `fetchFacts`
  returns null. Assign with `=`.
- Match window lengths before comparing two systems. Mon–Fri vs Mon–Sun is ~25 bookings.
- Use `readAllPages` (`src/lib/services/paged-read.ts`) for paged reads. It returns partial
  rows **alongside** an error rather than throwing, so check `error` and refuse to report a
  number when it is set — a short read silently shortens a denominator and looks like drift.
- `renderMarkdown` is non-GFM by default. Pass `{ gfm: true }` for tables. Do not flip the
  default: every news post and SEO page body renders through the same function.
- `REPORTING.md` reaches production only through `outputFileTracingIncludes` in
  `next.config.ts`. Remove that entry and `/admin/data` passes locally and fails live.
- **The checkout is shared.** Another agent's commit swallowed this session's whole
  Data Trust page. Stage explicitly, never `git add -A`, and check `git log` before assuming
  your working tree is yours.
- **The repo tracks `package-lock.json` (npm) but `node_modules` is pnpm-managed.** Local and
  production resolve dependencies differently. `pnpm-lock.yaml` and `pnpm-workspace.yaml` are
  untracked strays. Someone should decide which manager this repo uses.
- Check whether a spec filename already exists before writing one.
- A push to `main` publishes to www.vendingpreneurs.com in ~1 min.

## Owed by Adam

- **Rotate two Avoma keys.** One was pasted in chat; a second sits in plaintext at
  `~/attention-to-avoma/HANDOFF.md:30`. New key into `~/vp-webinars/.env` only.
- **Ask Kody** which report "New Form Submissions (VP)" comes from. The only unsourced number
  in the estate: ~1.31× our total capture W7–W9, then 1.15× at W10.
- Stale "Anthony Q&A" GHL custom value still reads "Thursday, September 17".

## Also open, from earlier handoffs

- **`~/vp-webinars` scheduled refresh is failing.** Last three scheduled runs red; today's
  17:05 run was _cancelled after 1h10m_, so it is now timing out, not just erroring. Manual
  dispatches pass. Cause known: `ghl_outreach.py`'s coverage guard aborts all-or-nothing, so
  cohorts that refreshed correctly are discarded with the ones it cannot reach. Fix: carry the
  committed entry forward per cohort, publish the rest, print the carry-forward loudly.
- Decision 2 implementation: label "Won — attended the room" vs "Won — webinar-attributed"
  and render the per-cohort gap with its reason. `REPORTING.md` §7 has the evidence.
- Instagram's 23 `directBooked` — needs evidence before changing.
