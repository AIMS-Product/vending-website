# Marketing scorecard on /admin/analytics + Metricool disconnect is loud

Date: 2026-10-08 · Owner: Adam (marketing) · Branch: `feat/marketing-scorecard`

## Why

Adam owns marketing and reports the Q4'26 Leadership Scorecard rows (ex-Kody, now Jess):
Total Booked Calls, MQLs, Cost per Qualified Lead, Ad Spend. None of them is on the dashboard by
week, and on 2026-10-01 Google Ads spend vanished with no warning anywhere.

## Root cause (Google spend)

Metricool answers 403 "There is no adwords connection for blog: 6626386" for every date since the
connection was removed (~2026-09-30). `fetchCampaigns` (client.ts) maps 403 to `[]`, so:

- `metricool-ads` sync writes no Google rows and records a clean run;
- nightly `ad-spend` audit sums `[]` = 0 on the platform side and agrees with our 0.
  GA4 still shows 60-98 Google Ads visits a day, so the ads run; only reporting is blind.

## Slice 1: a lost ad connection is a failure

- `fetchCampaigns` throws `MetricoolNotConnectedError` on 403 (posts/YouTube keep tolerating 403:
  brands legitimately lack those networks).
- Sync: catch per network, stop asking for that network, still write the others, set run
  `error` naming the network and the fix. Trust bar + "Every connector ran cleanly" go red.
- Audit: a not-connected network fails `ad-spend` with the same plain text.
- Not fixable in code: someone with Google Ads access reconnects it in Metricool.

## Slice 2: weekly scorecard card (top of /admin/analytics)

Mon-Sun weeks (matches Kody's Q3 row), last 8 weeks, newest left (this week and last are what gets read), current week marked "so far".

| Row                            | Definition                                                          | Source                           |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------- |
| Total booked calls             | Close first calls dated in the week, every one (Kody's Total basis) | `close_lead_funnel`              |
| · after exclusions / marketing | §3 rule; marketing = not Lane 2                                     | same                             |
| MQLs                           | Captured: site leads + contacts (§4), UTC days                      | `channel_daily` via `fetchFacts` |
| · scored qualified             | site form fills scored lane_1 / top_closers / setting               | `lead_submissions`               |
| Ad spend                       | Sum of spine spend, by Google / Meta                                | `channel_daily` (Metricool)      |
| Cost per MQL                   | Ad spend / MQLs                                                     | derived                          |

A paid network that recorded spend anywhere in the eight weeks but has a settled day (before today)
with no spend row marks that week's spend and cost "Incomplete", with a banner naming the network
and the days. Each row says its source on screen (glossary + METRICS.md §16).

Verified 2026-10-08 by hand: W1 (9/28-10/4) = 140 calls, 694 captured, $10,215 (Google through
9/30 only), $14.72.

## Out of scope

Changing campaigns, reconnecting Metricool, Close mirror (verified exact: 8,747 = 8,747).
