# Google Ads baseline, frozen 2026-10-10 (before the booked-call system)

Measured 2026-10-11 from `google_ads_campaign_daily` (Google Ads Script, matches
the Ads UI to the cent for Oct 3-9: $1,176.10 / 529 clicks / 6,143 impr) and
`lead_submissions` with a gclid (one lead per gclid). Wins are site-lead wins.

## What changed on 2026-10-10

- Google bids toward **booked calls** (CRM - Booked Call, fed daily by
  `/api/admin/google-ads-booked-calls/run`), not only form fills.
- Brand moved to Maximize conversions; Web Retargeting paused; junk goals off.
- Keyword (`utm_term`) now on every lead; gclid cleaned before Qualified /
  Closed Won uploads.
- Reporting: `/admin/analytics/google-ads` (spend to booked call to won, by
  campaign and keyword).

## Baseline: last 30 days (2026-09-10 to 2026-10-09)

| Metric                   | Value             |
| ------------------------ | ----------------- |
| Spend                    | $8,208.72         |
| Clicks                   | 3,085             |
| Leads (gclid)            | 105               |
| Booked calls             | 55 (52% of leads) |
| Won                      | 4, $27,888        |
| Cost per lead            | $78               |
| **Cost per booked call** | **$149**          |
| Won value / spend        | 3.4x              |

| Campaign             | Spend  | Leads | Booked | Cost / booked    |
| -------------------- | ------ | ----- | ------ | ---------------- |
| VP W2 Consideration  | $6,052 | 85    | 41     | $148             |
| Competitive Conquest | $1,653 | 6     | 5      | $331             |
| VP Brand             | $188   | 10    | 7      | $27              |
| Mike VSL 2026        | $208   | 0     | 0      | -                |
| Web Retargeting      | $108   | 0     | 0      | - (paused 10-10) |

## Baseline: last 90 days (2026-07-12 to 2026-10-09)

Spend $42,730, 290 leads, 149 booked (51%), 11 won $77,367. Cost per lead $147,
**cost per booked call $287**, won value / spend 1.8x. Retargeting $1,661 and
Mike VSL $1,070 produced 0 booked calls; Competitive Conquest $669 per booked call.

## How to compare

Open `/admin/analytics/google-ads` with a custom range of the same length after
2026-10-24 (two weeks of learning). The headline is **cost per booked call**
against $149 (30d), plus booked calls per week at similar spend.
