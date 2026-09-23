# The nightly data audit and the EOD / EOW reports

Nobody has to remember to check the numbers. Every night the site asks each
source system what it has, puts it beside what we stored, and says whether the
two agree. The result heads the daily and weekly emails, so a number is never
read without the verdict that goes with it.

Runs as plain code on Vercel cron. No model, no tokens, no cost per run.

## Schedule (Pacific)

| When         | What                                            | Route                                    |
| ------------ | ----------------------------------------------- | ---------------------------------------- |
| 5:30am daily | The audit, after every connector has finished   | `/api/admin/data-audit/run`              |
| 5pm daily    | End-of-day report by email                      | `/api/admin/data-report/run?period=day`  |
| 5pm Thursday | End-of-week report, the Friday-to-Thursday week | `/api/admin/data-report/run?period=week` |

Reports go to `adam@modern-amenities.com`. Add readers with the
`DATA_REPORT_TO` environment variable (comma separated) — no deploy needed.
A failed check also posts to Slack immediately; a passing audit stays silent.

## What is checked

Each check compares one stored number to the system that produced it, over a
window that source has finished restating (GA4 settles in two days, ad spend
in about one, YouTube in three — so the windows end before that).

| Check                      | Ours                                   | Source                                            | Tolerance |
| -------------------------- | -------------------------------------- | ------------------------------------------------- | --------- |
| Channels & KPI visits      | `channel_daily.visits`                 | Google Analytics sessions                         | 2%        |
| Funnels & Executive visits | `ga4_page_views.sessions`              | Google Analytics sessions                         | 2%        |
| First calls booked         | `close_lead_funnel`                    | Close, counted by Close itself                    | 1%        |
| Close mirror is current    | last crawl time                        | —                                                 | 3 hours   |
| Calls on the calendar      | `calendly_bookings`, distinct events   | Calendly scheduled events                         | 2%        |
| Ad spend                   | `channel_daily.spend`                  | Metricool, per campaign per day                   | 1%        |
| Off-site form fills        | `channel_daily.leads` on the form keys | GoHighLevel submissions                           | 1%        |
| YouTube views              | `youtube_video_daily.views`            | YouTube, or Metricool when OAuth is not connected | 2%        |
| Webinar numbers arriving   | `webinar_events.received_at`           | the vp-webinars push                              | 8 days    |
| Month over month: won      | the tab's own loader, last full month  | Close leads booked that month, stage Closed / Won | 3%        |
| Month over month: revenue  | the tab's own loader, last full month  | won deal value on those same Close leads          | 3%        |
| Month over month: leads    | the grid's Leads cells, per channel    | `lead_submissions`, per channel                   | exact     |

Plus the shapes past bugs left behind, checked against nothing but themselves:

- **No campaign day counted twice.** A renamed ad campaign used to leave its
  old row behind with its spend intact (Sep 15 2026: $462 counted twice).
- **Nothing counted on a row its sync dropped.** The spine is upsert-only, so
  a row whose key a sync stopped writing keeps its last value and is summed
  forever. One check per metric, each row judged by the sync that owns it,
  inside that sync's own re-read window as of its latest clean run: a row
  stamped an older day than the newest row the same sync wrote on the same
  day was not rewritten. Days older than the window are history, not
  orphans, and are not read.

  | Check                     | Sync (window re-read each run)                                                        | On a hit |
  | ------------------------- | ------------------------------------------------------------------------------------- | -------- |
  | `spine-orphaned-bookings` | every booking writer together, last 90 days                                           | fail     |
  | `spine-orphaned-spend`    | metricool-ads (3 days)                                                                | fail     |
  | `spine-orphaned-visits`   | ga4-visits (3 days)                                                                   | fail     |
  | `spine-orphaned-leads`    | ghl-forms on its form-route keys (3 days); leads on every other key (120 days)        | warn     |
  | `spine-orphaned-clicks`   | metricool-ads (3 days), youtube-analytics (7 days to yesterday), metricool-posts (30) | warn     |
  | `spine-orphaned-won`      | leads (120 days)                                                                      | warn     |

  Spend and visits fail because a clear already runs every night for them
  (renamed ad campaigns, GA4's superseded keys), so a hit means that clear
  broke. Nothing blanks a dropped lead, click or win yet, so those warn: a hit
  is a row to repair by hand. Not checked, on purpose: webinar-ingest (the
  sender picks which days it re-sends, and the run does not record it),
  manychat-ingest (one fixed key a day, rewritten only when that day has an
  event), ghl-email (writes each day once and never re-reads it) and
  bitly-clicks (has never written a row). The oldest day of each window is
  skipped, because a report cut at a day boundary may re-read it only in part.
  Metricool ads and posts are judged per source (network or brand): a clean
  run can get an empty list back for one network while the other answers.

  **A warn is not quiet.** Slack gets every audit that is not a clean pass
  (`alertOnAuditFailure`), warns included, so one stranded lead or won row
  posts every night until it is repaired or ages out of the leads sync's
  window: up to 120 days. Repair it the day it appears; see below.

- **No day is missing.** A failed fetch leaves a hole that is invisible in a
  monthly total (YouTube had no Sep 10 until it was found this way). Visits
  are checked to two days back, YouTube to three: ending YouTube at two failed
  this every night on a day YouTube had not reported yet.
- **Every lead reached Close.** A lead that never synced is a lead no rep sees.
- **Every connector ran cleanly.** Includes "nothing ran at all", which is a
  dead cron, not a healthy night.

## Rules the checks obey

- A source that cannot be reached is **never** counted as agreement. It reports
  as not verified, and the email says the numbers are unverified.
- Two observed zeros agree. One side reporting nothing while the other has
  numbers is a failure, not a rounding difference.
- Past tolerance warns; past twice tolerance fails.
- The run never crashes as a whole: one source throwing costs one check.

## Running one by hand

```bash
CRON_SECRET=... # from Vercel
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://www.vendingpreneurs.com/api/admin/data-audit/run
# Preview an email without sending it:
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.vendingpreneurs.com/api/admin/data-report/run?period=day&dryRun=1"
```

## When a check fails

1. Trust the source, not us. The check names both numbers and the window.
2. Look at what changed in that window: a connector error in
   `channel_sync_runs`, a renamed campaign, a migration that was never applied.
3. Fix the cause, re-run the audit by hand, and confirm it passes before
   sending any number onward.

## Stranded spine rows

A `spine-orphaned-*` check names the largest stranded rows by day and key
(source / medium / campaign / content). To list every candidate for one
metric, read-only (swap `leads` and the dates for the check's metric and
window):

```sql
select c.day, c.source, c.medium, c.campaign, c.content, c.destination,
       c.leads, c.synced_at
from channel_daily c
where c.leads <> 0
  and c.day between '2026-05-27' and '2026-09-23'
  and c.synced_at::date < (
    select max(d.synced_at)::date from channel_daily d
    where d.day = c.day and d.source = c.source and d.leads is not null
  )
order by c.leads desc, c.day;
```

This groups by day and source, which is close to what the check does, not
the same. Skip rows the check leaves out on purpose (webinar-register rows,
`manychat`, `ghl_email`). Then, for each row that really is stranded, either
set that one metric to null on its exact key, or re-key it onto the link it
belongs to. Do not delete the row: other connectors' numbers (visits on a
lead row, say) live on the same row.

```sql
update channel_daily set leads = null
where day = '…' and source = '…' and medium = '…' and campaign = '…'
  and content = '…' and destination = '…';
```

Re-run the audit by hand afterwards and confirm the check passes.

## Gotchas found while building this

- **GoHighLevel's `endAt` is exclusive.** Asking for a window's own last day
  returns nothing for that day (measured: 112 submissions to `endAt=09-18`,
  129 to `endAt=09-19`). Both the connector and the check ask one day past.
- **Close counts for you.** `include_counts: true` on `/data/search/` returns
  the total without paging thousands of leads.
- **GA4 wide ranges fold rows into `(other)`.** Totals stay right, so the audit
  compares totals only; a per-key repair must go one day at a time.
