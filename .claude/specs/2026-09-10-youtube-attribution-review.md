# YouTube attribution — review findings

Date: 2026-09-10
Against: commit `1f305cb` (local only, never pushed)
Verdict: **BLOCK — do not deploy until items 1-3 of the fix order are done**

## Status 2026-09-10 — fix order items 1-5 done, still local and unpushed

Fixed with a failing test written first for each: C1, C2, C3, H5, H6, H4, M14,
M15, plus the two test-only hardenings (bitly `onConflict`, page-view `{ error }`
return). Suite 253 files / 2055 tests green, typecheck clean, build clean.

Still open, in this file and NOT done: H7, H8, M9-M13, every LOW item, the
rate-limiter decision, and the live Bitly `{bitlink}` encoding check.

## Status 2026-09-11 — everything above is now closed on `fix/youtube-attribution-polish`

Overnight polish pass. Branch pushed as a draft PR; not merged. Suite 260 files
/ 2,162 tests green, typecheck clean.

| Item                                             | State                  | Where                                                                                                                                                                                                                         |
| ------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H7 any error reads as "not connected"            | done                   | `9ebbdb1` — only 42P01, 42703, PGRST204, PGRST205 mean not connected; everything else is logged with code and message and still reported as unmeasured                                                                        |
| H8 clicks window vs range                        | done                   | `119a7ae` — one bounded `order("day").limit(1)` finds the first synced day; an earlier range start reports clicks as unmeasured and the coverage note names the boundary                                                      |
| M9 funnel not monotonic                          | done, decision taken   | `3ea040d` — a won lead counts as booked. See "Decisions taken" below                                                                                                                                                          |
| M10 per-video clicks 0 not null                  | done                   | `f570e93` — a zero is only honest for a link that is actually synced                                                                                                                                                          |
| M11 cohort win in neither column                 | done                   | `f570e93` — the later column is everything that is not the cohort month                                                                                                                                                       |
| M12 coverage note names the wrong set            | done                   | `f7e49e4` — plus the first test file for these panels                                                                                                                                                                         |
| M13 re-import wipes Bitly ids                    | done                   | `f8fc562` — `splitByBitlyLink`; the 605 rows that carry a link still seed it                                                                                                                                                  |
| LOW `daysBetween` returns -1                     | already fixed          | shipped with the day-key work; two tests cover it (`youtube-attribution-rollup.test.ts` "unparseable won date", "unparseable booking date")                                                                                   |
| LOW `(untagged)` in campaignsMissingFromRegistry | done                   | `f570e93`                                                                                                                                                                                                                     |
| LOW unused `clickToLeadPct`                      | done, deleted          | `dab027c`                                                                                                                                                                                                                     |
| LOW `bitly-click-sync.ts:108` null-id row        | done                   | `dab027c` — only an exhausted queue ends a worker                                                                                                                                                                             |
| LOW `CRON_SECRET` min length                     | **SKIPPED ON PURPOSE** | Production's value cannot be read from here. If it is shorter than a new minimum, config parsing fails and the whole site goes down. Adam's call, with the value in front of him                                              |
| Rate-limiter decision                            | done                   | `07bbaa0` — `attribution_event` fails closed, lead paths stay open, pinned by a test                                                                                                                                          |
| Bitly `{bitlink}` encoding                       | done                   | `e3ddb58` — Bitly's own example is `/v4/bitlinks/bit.ly/12a4b6c/clicks`, an unencoded slash. Validated against `^[a-z0-9.-]{1,80}/[A-Za-z0-9_-]{1,80}$` first. **Still needs one live call once `BITLY_ACCESS_TOKEN` exists** |

### Decisions taken

- **M9: a won lead counts as booked and attended.** A sale cannot happen
  without a call, and excluding a real win from the closed stage would
  understate the revenue this page exists to attribute. The cost: "Booked a
  call" here reads very slightly higher than the same figure on the other
  analytics tabs, which count `call_booked_at` alone. No production number
  moved — there are no won-without-booked-date YouTube leads today, so this is
  a guard rather than a change.
- **The Bitly runner now returns 500 when links fail**, matching the GA4
  runner. It returned 200 with `ok: true`, which is how `bitly_link_clicks`
  could sit at zero rows with nobody noticing.

### Browser QA, all four ranges (first time this tab has been driven)

Production data, read-only, through `next dev`. Before and after screenshots in
`.claude/specs/2026-09-11-polish-screens/`.

| Range | Visits | Leads | Booked | Won | Load     |
| ----- | ------ | ----- | ------ | --- | -------- |
| 7d    | 233    | 27    | 16     | 1   | 1.4-3.1s |
| 30d   | 1,287  | 153   | 111    | 12  | 1.4-2.2s |
| 90d   | 4,139  | 230   | 155    | 17  | 1.5-1.8s |
| 1y    | 8,652  | 230   | 155    | 17  | 1.6-2.3s |

No console errors on any range. No percentage over 100% on any range. The
coverage note reads "GA4 sessions by Pacific day" as expected. The one thing
the QA found: **"Link clicks" rendered a hard `0`** on every range, because
`bitly_link_clicks` exists but is empty and `clicksConnected` was therefore
true. It renders `—` now.

Two decisions taken while fixing:

- **C3 is strictly `status_type === "won"` — now CONFIRMED CORRECT, not a
  guess.** Q9 answered by read-only probe on 2026-09-10
  (`scripts/probe-close-opportunities.mjs`): all 12 sampled `🏆 Closed / Won`
  leads carry an Opportunity, all 13 opportunities have
  `status_type: "won"`, a real `date_won` and a value, and NONE is missing
  `status_type`. So the strict filter rejects nothing real, and time-to-close
  can be backfilled retroactively rather than only counting from now.
- **Day keys are UTC** (`ponytail:` note on `daysBetween`). If Close dates wins
  in Pacific, a win logged before 5pm PT on a month boundary is credited to the
  next UTC day.

**H6 re-derived: the returning-lead count is 3, not 20.** Read-only production
probe after the day-key fix. The old 20 was 14 same-day bookings the instant
comparison made negative plus 3 real ones (gaps −117, −40, −15 days). Project
memory corrected.

`20260910130000_lead_page_view_utm_caps.sql` is new and also unapplied — apply
it together with `20260910120000_youtube_attribution.sql`.

Production schema state, probed read-only 2026-09-10 after the push:
`youtube_videos`, `bitly_link_clicks` and `lead_page_views` all return
PGRST205 (absent) and the four new `lead_submissions` columns return 42703.
Neither migration has run. Apply them in filename order and ONLY these two --
do not use `supabase db push`, which applies everything the remote migration
history does not already know about, and this project applies migrations by
hand so that history cannot be trusted to match.

Two review passes (code + security) ran against the commit. Findings below were
spot-checked by hand against the files. Nothing here has been fixed.

## Fix in this order

1. Reconciler two-shot select (C1) — this one breaks existing production behaviour
2. The `won` label match and the opportunity filter (C2, C3) — these report lost deals as wins
3. Day-key date comparison (H5, H6), then re-derive the returning-lead count
4. Visits channel filter (H4), read caps (M14), UTM length caps (M15)
5. Rewrite the six weak tests so each fails against current code first

After applying anything below, run `npm run typecheck`,
`node_modules/.bin/vitest run`, and `npm run build`.

---

## CRITICAL

### C1 — The Close reconciler stops working entirely until the migration is applied

`src/lib/services/close-booking-reconcile.ts:102`

The claim select now reads:

```ts
.select("id,close_lead_id,call_status,closed_won_at,closed_won_source")
```

`closed_won_at` and `closed_won_source` do not exist until
`supabase/migrations/20260910120000_youtube_attribution.sql` is applied by hand.
PostgREST returns 42703, `error` is set, and line 108 throws. The cron route
swallows it (`src/app/api/admin/close-sync/run/route.ts`), so every 2-minute run
reconciles ZERO leads.

That freezes `call_booked_at` / `call_status` / `call_reconciled_at` — the
existing booking mirror feeding the "Booked" number on all four pre-existing
analytics tabs — from the moment this deploys until someone runs the SQL.

Confirmed independently: a production probe of
`lead_submissions?select=id,call_outcome,closed_won_at,closed_won_source`
returned HTTP 400 / code 42703, while the base-column select returned 200.

The same failure repeats at the write: `outcomeUpdate` spreads four
non-existent columns into the `update`, so even with the select fixed every
write 400s.

Fix: mirror the two-shot pattern already used by `fetchLeads` / `selectLeads` in
`src/lib/services/youtube-attribution.ts` — try the extended select, fall back to
the base columns, and only spread `outcomeUpdate` into the patch when the
extended select succeeded.

### C2 — A Close label containing "Won't" is recorded as a won deal

`src/lib/services/close-booking-reconcile.ts:181-187` and `:203-241`

`outcomeFromLabel` normalises by replacing every non-alphanumeric run with a
space, so `Won't` becomes `won t`, and the pattern `/\bwon\b/` matches it.
A label such as `Lost - Won't Sign` therefore yields `call_outcome='won'` and
also stamps `closed_won_at = today` with `closed_won_source='status_observed'`.

`isClosedWon` in the rollup tests `Boolean(closed_won_at)`, so the lead is
counted as a win on the report. The stamp is permanent — `outcomeUpdate` only
ever sets `closed_won_at`, never clears it, so a later corrected label does not
undo it.

Fix: match the normalised phrase (`closed won`) rather than a bare `won`, or
require that the label does not contain `won t`. Separately, clear
`closed_won_at` / `closed_won_source` back to null when the outcome is no longer
won and the existing source was `status_observed`.

### C3 — `earliestWonDate` accepts a date from a lost or active opportunity

`src/lib/services/close-booking-reconcile.ts:265-278`

```ts
.filter((o) => o?.status_type === "won" || Boolean(o?.date_won))
```

The `||` means any opportunity carrying a `date_won` qualifies regardless of its
`status_type`. Close retains `date_won` on opportunities that were won and later
re-opened or marked lost. Such a row is then written with
`closed_won_source='close_opportunity'` — the one provenance the design treats as
trustworthy enough to feed median cycle time.

Fix: require `status_type === "won"`. Note the edge case before switching to a
bare `&&`: if an org returns opportunities with no `status_type` at all, a strict
`&&` rejects every one. Decide deliberately and cover both shapes in tests.
This interacts with open question 9 for Kody — whether Close creates
opportunities here at all is still unconfirmed.

## HIGH

### H4 — "Landing page visits" counts every tagged channel, not just YouTube

`src/lib/services/youtube-attribution.ts:204-216` selects `utm_campaign,occurred_at`
from `lead_page_views` with no `utm_source` filter, and the rollup sums all of
them into `totals.visits`. `recordTaggedPageView` stores every campaign-tagged
view, and the site runs Meta, Google and Instagram traffic.

A Meta campaign driving 5,000 tagged visits therefore lands in the YouTube
funnel, and the "Leads captured" step reads `244 / 5244` instead of the real
YouTube rate. Per-video rows are unaffected (they join on the campaign slug);
the totals and the whole stage funnel are wrong.

Fix: filter on `utm_source` (the column exists on the table) or restrict to
campaigns present in `youtube_videos`.

### H5 — Comparing a `date` column against a timestamp instant drops same-day closes

`src/lib/services/youtube-attribution-rollup.ts:482-487`

`closed_won_at` is a Postgres `date`, so `new Date("2026-08-01")` is UTC
midnight, while `firstTouchAt` returns a real instant.

- First touch `2026-08-01T18:00Z`, won `2026-08-01` gives −0.75, rounds to −1,
  and is dropped by the `days >= 0` filter. Every same-day close whose first
  touch is after 12:00 UTC (after 5am Pacific — effectively all of them)
  disappears from time-to-close and is reported as "won without a reliable date".
- First touch `2026-08-01T18:00Z`, won `2026-08-15` gives 13 days, so a genuine
  14-day cycle lands in the "8-14 days" bucket and never counts toward
  `longCycleCount`.

Fix: compare day keys (`firstTouchAt(lead).slice(0, 10)` against `closed_won_at`)
rather than instants.

### H6 — Same root cause inflates the returning-lead count

`src/lib/services/youtube-attribution-rollup.ts:421-424`

`call_booked_at` is also a `date`. A lead created `2026-08-10T18:00Z` and booked
`2026-08-10` computes as −1 and is counted as "booked before they filled the
form".

The figure of 20 such leads was measured with this flaw present and was reported
to Adam as a verified fact, including in project memory. **Treat it as
unverified and re-derive it after the day-key fix.** This function also uses
`created_at` where the rest of the module uses `firstTouchAt`.

### H7 — Any read error is reported to the user as "not connected"

`src/lib/services/youtube-attribution.ts:155-172` and `:226-236`

`selectLeads` returns null on any `error`, and `degradable` has a bare `catch {}`.
A statement timeout, a 503, or a transient blip therefore falls through to the
base select, and the page then states as fact that the migration has not been
applied — when it has, the data exists, and nothing was logged.

Fix: match only the schema errors (`42P01`, `42703`, `PGRST204`, `PGRST205`) and
`console.error` everything else, as the cron routes already do.

### H8 — Clicks sync 30 days but are reported against 90d and 1y ranges

`src/lib/services/bitly-click-sync.ts:29` (`DEFAULT_DAYS = 30`) versus
`src/lib/services/youtube-attribution.ts:190-201`, which filters clicks from the
range start.

On a 1-year range `clicksConnected` is true, so the stage renders a real number
built from at most 30 days of clicks against 12 months of visits and leads. The
next stage's ratio is visits over clicks, which will read well above 100%.

Fix: either cap the clicks stage to the synced window with an explicit note, or
report clicks as unmeasured when the range starts before the earliest `day`
present in `bitly_link_clicks`.

## MEDIUM

- **M9 — the funnel is not monotonic.** `isClosedWon` does not require
  `call_booked_at`, so a lead won in Close with no booked date is counted at the
  bottom of the funnel but not at the two stages above it, rendering
  "200% continued from the step above".
  `youtube-attribution-rollup.ts:264-265, 298-306`.
- **M10 — a video with no Bitly link reports 0 clicks, not null.**
  `clicksConnected` is global, so once a token exists all 42 registry rows with
  `bitly_id: null` show a hard `0` beside real leads — the exact
  "0 clicks, 4 leads" reading the null-not-zero rule exists to prevent. Null it
  per-video when `bitly_id` or `clicks_synced_at` is null.
  `youtube-attribution-rollup.ts:191`.
- **M11 — cohort wins can fall in neither column.** A win dated before the
  first-touch month matches neither `=== month` nor `> month`, so the row shows
  Won 1 with both sub-columns 0. `youtube-attribution-rollup.ts:367-372`.
- **M12 — the coverage note attributes the exclusion to the wrong set.** It says
  the `bookedBeforeLead` count is excluded from cycle times, but `closeDurations`
  excludes a different set. `YouTubeAttributionPanels.tsx:475-484`.
- **M13 — re-running the registry import wipes discovered Bitly ids.**
  `scripts/import-youtube-registry.mjs:63-65` upserts the whole row, and 42 rows
  carry an explicit `bitly_id: null`. A re-import after `mapMissingLinks` filled
  them in resets them to null, and `claimBatch` never claims a null-id row again,
  so those links silently stop syncing. Omit `bitly_id` and `bitly_url` from the
  upsert payload.
- **M14 — two unbounded reads run on every admin page load.** Neither
  `bitly_link_clicks` nor `lead_page_views` gets a `.limit()`, while the lead
  read caps at 50,000. Both table indexes are partial on `utm_campaign` and
  neither query filters on it, so both are sequential scans. At 646 links times
  365 days the 1-year range is roughly a 235k-row scan per render, and any silent
  row cap truncates it into an understated clicks total with no signal.
  `youtube-attribution.ts:190-216`.
- **M15 — the public write path caps two fields and not the other three.**
  `src/lib/services/lead-page-views.ts:46-52` caps `path` to 300 characters and
  `vp_session_id` to 160, but `utm_source`, `utm_campaign` and `utm_content` are
  stored with only a trim. They arrive in the JSON body of
  `POST /api/attribution/events`, which is public and unauthenticated — its
  first-party check is CSRF-grade by its own comment — and the route's zod schema
  puts no length bound on `properties` values. `utm_campaign` is incidentally
  protected by its btree index; the other two are not. There is also no prune job
  for `lead_page_views`, unlike `public_request_hits`.
  Fix: cap all three at 200 characters, and add matching
  `check (length(...) <= 200)` constraints in a follow-up migration so no future
  caller can bypass it.

## LOW

- `youtube-attribution-rollup.ts:485` — `daysBetween` returns −1 for an
  unparseable date, which the `days >= 0` filter then swallows as if it were a
  negative duration, and which makes `bookedBeforeLead` count it as a returning
  lead.
- `youtube-attribution-rollup.ts:447` — the `"(untagged)"` bucket flows into
  `campaignsMissingFromRegistry`, so the coverage note reports `(untagged)` as a
  campaign missing from the registry.
- `youtube-attribution-rollup.ts:262` — `clickToLeadPct` is computed for every
  row and never rendered; there is no click-to-lead column.
- `bitly-click-sync.ts:108` — `if (!row?.bitly_id) return;` conflates "queue
  exhausted" with "this row has no id", so a null-id row would abandon the rest
  of that worker's share of the batch rather than skipping it.
- `src/lib/config.ts:42` — `CRON_SECRET` has no minimum length, unlike
  `SUPABASE_SERVICE_ROLE_KEY` which is `.min(20)`. Pre-existing.

## Decision needed — the rate limiter

`src/lib/public-rate-limit.ts:134-142` returns `!failClosed` with `failClosed`
defaulting to false, so any error means "allowed". Verified by reading the file.
And `supabase/migrations/20260801090000_public_request_hits.sql` states in its own
header that it is not applied, so today every public endpoint is effectively
unlimited.

That is pre-existing and deliberate — dropping a real lead costs more than
letting one through — but this commit attaches a database write to it (M15).

**CORRECTION 2026-09-10: the premise above is wrong.** `public_request_hits`
DOES exist in production (probed read-only: HTTP 200, while the three new
tables return PGRST205). The migration's "not applied" header comment is
stale, so the limiter has its backing table and public endpoints are NOT
unlimited. What remains true is only the fail-open default in
`public-rate-limit.ts:134-142`. The open decision shrinks to: pass
`failClosed: true` for the page-view branch, since a dropped analytics row
costs nothing. No migration needed for it.

## Test quality

The suite is green at 2036 tests, but two of the new tests picked the safe half
of a boundary and the most serious finding is untested:

- `close-booking-reconcile.test.ts:207-209` asserts `"Wonky pipeline stage"`
  (passes) but never `"Won't"` (fails — C2).
- `close-booking-reconcile.test.ts:225-227` asserts
  `{status_type:"active", date_won:null}`; the case that breaks is
  `{status_type:"lost", date_won:"..."}` (C3), so the existing test passes for
  the wrong reason.
- No test drives `reconcileCloseBookings` against a client whose select returns a
  missing-column error — C1 is exactly what is untested.
- `youtube-attribution-rollup.test.ts:167-230` uses only `T00:00:00.000Z`
  timestamps, the single case where the date arithmetic happens to be correct.
  One `T18:00:00.000Z` fixture fails (H5).
- `bitly-click-sync.test.ts:73` ignores the second `upsert` argument, so dropping
  `onConflict: "bitly_id,day"` would not fail a test.
- `lead-page-views.test.ts:100-112` covers a thrown error but not the
  `{ error }` return PostgREST actually gives for a missing table.

Write each of these as a failing test BEFORE the corresponding fix.

## Checked and found correct — do not re-litigate

- Null-versus-zero handling at the totals and stage level.
- Exclusion of `status_observed` dates from duration maths.
- The attended derivation (booked minus no-show minus cancelled).
- The first-touch cohort key with its `created_at` fallback.
- RLS on all three new tables: enabled, zero policies, zero grants. No anon or
  authenticated read path exists.
- The new `lead_submissions` CHECK constraints match the writer exactly.
- The `�` escape in `admin-analytics-detail.ts:137` (the six-character
  backslash-u-0-0-0-0 sequence) — behaviour-identical to the raw NUL byte it
  replaced, and it stops the file registering as binary to grep and other line
  tools. An earlier report in this session wrongly called `buildTopCampaigns` a
  live bug; it was not. The separator and the split were always the same NUL
  byte, which `sed` renders as a space.
- Both cron routes' `timingSafeEqual` length guard: the length check precedes the
  comparison, so the throw is unreachable, and query params are bounded.
- Bitly SSRF and token handling: both database-sourced path segments are
  `encodeURIComponent`-wrapped, `baseUrl` is never env-sourced, and no error path
  logs the token.
- Secret hygiene and `server-only` boundaries on every new module.
- The reconciler's validation of Close response shapes.
- The shared `cursor` in both worker pools is safe — `rows[cursor++]` has no
  `await` between the read and the increment. Do not "fix" it.

## One thing to verify against the real Bitly API

`src/lib/bitly/client.ts:122` wraps `bitlinkId` in `encodeURIComponent`, turning
`booking.vendingpreneurs.com/yt-x` into `...%2Fyt-x`. That is the correct
security choice, but Bitly's `{bitlink}` path parameter is conventionally sent
unencoded and may 404 on an encoded slash. The tests only exercise a mocked
client, so this has never touched the real API.

Do not simply drop the encoding. Validate the value against a strict pattern such
as `/^[a-z0-9.-]{1,80}\/[A-Za-z0-9_-]{1,80}$/`, reject anything that does not
match (these come from our own database, so a mismatch is a data problem, not a
request to service), then build the path from the validated value. Confirm with
one live call once `BITLY_ACCESS_TOKEN` exists.
