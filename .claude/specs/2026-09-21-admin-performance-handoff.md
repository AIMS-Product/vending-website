# Admin page performance — what changed, and what the next agent needs to know

**Date:** 2026-09-21 · Live on `main` as of `c03f5cc`. No counting rule, target, funnel
mapping or credit precedence was touched.

## Result, measured on production

| Page                            | Before | After    |
| ------------------------------- | ------ | -------- |
| `/admin/goals`                  | 14–18s | **1.4s** |
| `/admin/bookings`               | 4.5s   | **1.4s** |
| `/admin/analytics?tab=channels` | 6–12s  | **4.8s** |

The earlier handoff's 60–176s figures were cold-start numbers and did not reproduce warm.

## The cause was CPU, not the database

First byte was ~30ms on every admin page; the time was the server component streaming.
Timed against the real tables from a laptop, the whole booking read is ~0.6s and the whole
funnel read ~0.3s. The database was never the bottleneck.

`/admin/goals` reads about forty metrics over the same ~4,276 bookings, and every one ran
every booking through `toLocaleDateString`, which builds a fresh `Intl` formatter per call
— roughly 167,000 formatter constructions per request. Measured in isolation: 4.2s on a
laptop, and the page's server render was 11.8s on Vercel.

**Fixes (`c03f5cc`):** `dayKeyIn` keeps one formatter per timezone and memoises its result;
`funnelIndex` is keyed on the row array in a `WeakMap` instead of being rebuilt per metric.
`booked-metrics.test.ts` asserts every key against `toLocaleDateString`, read twice, so a
stale cache fails the suite.

## The paging helper — use it, do not write another loop

`src/lib/services/paged-read.ts` exports `readAllPages` (`ef3d825`). It asks the first page
for the exact count and then issues the remaining ranges concurrently, 12 in flight, and
returns `{ rows, error }` so each caller keeps its own failure policy — a partial read comes
back as rows plus an error and never collapses into a zero.

Already converted: `fetchFunnels`, `fetchBookings` (`booked-metrics-data.ts`),
`fetchCloseSetters` (`call-credit-data.ts`).

**Still on the old sequential pattern**, each with its own copy of a `page()` helper:
`channel-journeys-data.ts` · `link-coverage-data.ts` · `funnel-monthly-data.ts` ·
`goal-report.ts` · `funnel-executive.ts` · `team-report-data.ts` · `channel-report.ts` ·
`close-week-view-data.ts` · `booked-calls-data.ts` · `funnel-map.ts` · `kpi-report-data.ts` ·
`data-audit-checks.ts` · `admin-analytics.ts`.

**This matters for the channel spine work.** `channel_daily` is 32,720 rows — 33 pages. If
you touch `fetchFacts` or any other `channel_daily` read path, route it through
`readAllPages` rather than adding a fourteenth sequential loop.

## Verified after the change

`/admin/goals` reads target **619**, expected by today **433**, **4** leads with no funnel —
identical to the pre-change verified figures. Booked moved 454 → 468 and all-in 491 → 506,
which is bookings arriving during the day; "no funnel" holding at exactly 4 is the evidence
the concurrent read lost no rows. 2,740 tests pass, `tsc` clean, lint exit 0, build clean.

Also confirmed rendering, which the earlier handoff left open: **"Who closed them"** on the
channels tab lists 11 closers, 63 wins, $477,646 in the last 30 days.

## Open

- **Priority 2, the 41 admin routes**, is untouched. It needs Adam in the room — do not move
  routes unilaterally.
- Steps 2–4 of the old fix order (bounding the funnel lookup by email, caching the Close API,
  wrapping panels in `<Suspense>`) were **not built**. At 1.4s they buy nothing. Revisit only
  if a page regresses.
