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
| Calls on the calendar      | `calendly_bookings`                    | Calendly scheduled events                         | 2%        |
| Ad spend                   | `channel_daily.spend`                  | Metricool, per campaign per day                   | 1%        |
| Off-site form fills        | `channel_daily.leads` on the form keys | GoHighLevel submissions                           | 1%        |
| YouTube views              | `youtube_video_daily.views`            | YouTube, or Metricool when OAuth is not connected | 2%        |
| Webinar numbers arriving   | `webinar_events.received_at`           | the vp-webinars push                              | 8 days    |

Plus the shapes past bugs left behind, checked against nothing but themselves:

- **No campaign day counted twice.** A renamed ad campaign used to leave its
  old row behind with its spend intact (Sep 15 2026: $462 counted twice).
- **No day is missing.** A failed fetch leaves a hole that is invisible in a
  monthly total (YouTube had no Sep 10 until it was found this way).
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

## Gotchas found while building this

- **GoHighLevel's `endAt` is exclusive.** Asking for a window's own last day
  returns nothing for that day (measured: 112 submissions to `endAt=09-18`,
  129 to `endAt=09-19`). Both the connector and the check ask one day past.
- **Close counts for you.** `include_counts: true` on `/data/search/` returns
  the total without paging thousands of leads.
- **GA4 wide ranges fold rows into `(other)`.** Totals stay right, so the audit
  compares totals only; a per-key repair must go one day at a time.
