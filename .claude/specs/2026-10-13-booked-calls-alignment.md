# Booked calls: align vending-website + vp-webinars with Dom's proposal

Source: Dom's proposal https://aims-product.github.io/BTC-Systems/booked-calls-reporting-proposal/ (Slack 10-12, open
questions unresolved). Company dashboards: aims-product.github.io/{mtd-funnel-dashboard, rep-dashboard,
sales-manager-dashboard}. Measured 2026-10-13 05:30Z against our hourly mirror `close_lead_funnel` (synced 05:05Z).

## How each surface counts today

- MTD (since Dom's 10-05 commit "Align MTD booked totals with rep scorecard"): "First Sales Call Booked Date" in
  month, minus Canceled (by Lead) / Outside the US, minus TLG + PPA business lines, Quiz funnel out of totals, AND
  lead owner on the Lane 1 scorecard roster + Joe. MTD archives for Aug (821) and Sep (966) were built under the
  OLD rule (Reactivation Scrapers counted from Next Steps meeting activities, not the field) and were not recomputed; that is where the "821" in AGENTS.md comes from.
- "First Sales Call Booked Date" is written every 30 min by AIMS-Product/close-first-sales-meeting: earliest
  qualifying first-sales meeting by title (Vending Strategy Call, Vendingpreneurs Consultation/Strategy Call, New
  Vendingpreneur Strategy Call, Vending Consult\*), excluding follow-up/reschedule/Next Steps/enrollment/Q&A titles.
- vending-website: same field + same status/Quiz exclusions, no TLG/PPA filter, no roster filter. Lane 2 =
  funnel in {Reactivation Scrapers, Sales Reactivation} (`channel-targets.ts`, booked-metrics pace).
- vp-webinars: room bookings from the Booked Calls sheet / Calendly; Lane 2 = "Sales Team Lane" (`is_lane2`,
  since 6a9d4d1, 10-12), funnel fallback.

## Measured

Oct 1-12, ours 238 vs MTD 212. Per marketing funnel within 0-2 (Webinar 77/75, YouTube 18/18, Website 11/10,
Instagram 9/8, Google 5/5, Meta 5/4). Gap is Reactivation Scrapers 101 vs 81 = MTD's Lane 1 roster filter.
Sep, ours 665 vs MTD archive 966 (old rule, not comparable).

Lane 2 by three fields (after exclusions):
| Month | Funnel = scraper | Sales Team Lane = Lane 2 | Booked By = Lane 2 |
|---|---|---|---|
| Sep | 272 | ~108 | 292 |
| Oct 1-12 | 101 | ~41 | 116 |
Sales Team Lane follows the current owner (Lane 1 closer after a Lane 2 set), so it is not booking credit.
50 Sep / 33 Oct bookings were relabeled to their source funnel (mostly Internal Webinar) and are Booked By = Lane 2
but Sales Team Lane = Lane 1: the webinar board counted them as the room's marketing bookings.

## Decision taken here (not an open question in Dom's doc)

Lane 2 booking credit = Booked By = "Lane 2" (Dom's field for credit); when blank (every marketing booking), the old
scraper funnel label only. Sales Team Lane is never read: it follows the current owner (98 webinar self-books owned
by Lane 2 closers would have left the room). Funnel Name = source.

- vp-webinars `is_lane2`: changed (branch fix/lane2-from-booked-by).
- vending-website: no code change. Channel rows and the marketing pace already count by Funnel Name (source), which
  is Dom's model; the scorecard already reports `bookedByLane2` from Booked By. The goals-page "Lane 2" row is the
  scraper-funnel SOURCE row; relabel it only when Dom's Booked By buckets are approved.

## Waiting on Dom (do not build)

Meeting-activity counting, title list, rep credit, TLG/PPA/Quiz in MTD, repeat window (60 d?), booking date vs
call date. When approved: run old and new side by side 2 weeks, note the switch date on both dashboards.

## Data-quality flags for Dom (Close writes are his)

- Sep: 86 bookings still in "Reactivation Scrapers" carry entry_source Webinar, 28 Lead-Magnet (Oct: 22, 7);
  his relabel did not move them.
- Booked By is only ever "Lane 2" or "Social DMs" so far; Marketing / Webinar / YouTube are never filled.
