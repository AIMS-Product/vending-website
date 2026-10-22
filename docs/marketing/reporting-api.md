# Reporting API

Read-only JSON of the Channels tab, for anyone who wants the unified channel
numbers without the admin UI: a spreadsheet, a partner's dashboard, or an AI
agent pointed at the URL.

## Endpoint

```
GET https://www.vendingpreneurs.com/api/reporting/channels?range=30d
Authorization: Bearer <REPORTING_API_KEY>
```

| Parameter | Values                          | Default |
| --------- | ------------------------------- | ------- |
| `range`   | `7d`, `30d`, `90d`, `1y`        | `30d`   |
| `channel` | a channel label, e.g. `YouTube` | none    |

With `channel` set, `drill` holds the same report grouped by campaign,
content and destination for that channel.

## Response

The exact object the Channels tab renders, plus `ok` and `generatedAt`:

- `range`: key, label, days, start and end day.
- `report`: funnel stages, one row per channel (`rows`) with metrics, paired
  rates and period-over-period deltas, plus `tail` (visit-only rows).
- `syncHealth`: one row per connector, last run, rows written, error text.
- `confidence`: coverage matrix and the reconciliation checks against
  `lead_submissions`, `webinar_events`, `ga4_page_views`, `calendly_bookings`.
- `goingOut`: every registry link with clicks in range.
- `fixLinks`: posts whose outbound link fails the link standard.

Every metric is a count or money; `null` means not observed, never zero.

`leads` follows the one lead definition (`src/lib/analytics/lead-definition.ts`):
one person who gave name and email on the site or to the chatbot, the same
email within 30 days counted once, newsletter signups and test submissions
excluded. It matches every tab of `/admin/analytics`. Webinar registrations,
off-site GHL form fills and ManyChat contacts are in `contacts`, never `leads`.
Aggregates only, no names, emails or lead ids.

## Example

```
curl -s -H "Authorization: Bearer $REPORTING_API_KEY" \
  "https://www.vendingpreneurs.com/api/reporting/channels?range=90d" | jq '.report.rows[] | {channel, leads, booked}'
```

For an agent (Claude Code, Codex, a custom tool): give it the URL and the key
as an environment variable and tell it to fetch with the bearer header. There
is no query-string key on purpose: it would end up in logs.

## KPI framework

```
GET https://www.vendingpreneurs.com/api/reporting/kpi?range=30d&format=csv
Authorization: Bearer <REPORTING_API_KEY>
```

Same key and `range` values. `format` is `json` (default) or `csv`. The
report is the Lead Gen KPI Framework: four sections (content and website
funnels, webinar funnel, marketing re-engagement, Lane 2), each with the
sheet's columns plus source of truth, owner, cadence and last verified. The
CSV is one block per section separated by a blank line.

To fill a Google Sheet, add this Apps Script and run `pullKpi` on a trigger
(the key lives in Script Properties, never in a cell):

```
function pullKpi() {
  const key = PropertiesService.getScriptProperties().getProperty("REPORTING_API_KEY");
  const csv = UrlFetchApp.fetch(
    "https://www.vendingpreneurs.com/api/reporting/kpi?range=30d&format=csv",
    { headers: { Authorization: "Bearer " + key } },
  ).getContentText();
  const rows = Utilities.parseCsv(csv);
  const sheet = SpreadsheetApp.getActive().getSheetByName("KPI");
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
```

## Key

`REPORTING_API_KEY` in `.env.local` and Vercel (Production and Preview).
Rotate by replacing it in both places and redeploying; nothing else depends
on it. Missing key answers 503, wrong key 401.

## Call Forecast for Mac

`GET /api/reporting/call-forecast` uses the same bearer key and returns only
aggregate channel counts for **new marketing calls booked today, Eastern time**.
It wraps the existing `readBookedMetric("newBookedOn")` and `attributionFor`
functions; it does not read the channel spine or change attribution rules.

The response is schema version 1 with `day`, `timeZone`, `basis: "booked-on"`,
`metricKey: "newBookedOn"`, `scope: "marketing"`, `total`, `channels`,
`coverage`, `generatedAt`, and `sourceUpdatedAt`. Cancellations are included;
Lane 2 outbound, follow-ups, reschedules, other brands and unreviewed event
types are excluded under the existing metric. Missing channel attribution
stays explicitly unattributed. Source read failures return an error, never a
zero count. Channel counts must sum to the headline total.

`generatedAt` is request time, not proof that an upstream sync ran.
`sourceUpdatedAt` is null until a suitable upstream freshness contract exists.
The endpoint is private and `no-store`; it returns no names, emails, lead ids,
raw event payloads or credentials. A missing reporting key returns 503; an
invalid bearer returns 401. Merely deploying this route does not activate
reporting access: `REPORTING_API_KEY` must be configured through normal hosting
settings and kept in a local `.env` file on the Mac.

### Call Forecast weekly progress

The same schema-version-1 response also includes `week`: `start` (Monday),
`end` (Sunday), `total`, seven `days` entries (`date`, `total`), and aggregate
`coverage`. Week boundaries use the existing Eastern reporting timezone. Each
elapsed day reuses `readBookedMetric("newBookedOn")`; `week.total` is their sum.
The current day equals the existing top-level daily total. Future days have
`total: null` and never pretend to be an observed zero. Undatable source rows
are reported once as an unknown-date coverage gap, rather than summed per day.

The Mac owns the user-editable weekly goal (initially 125), progress and pace.
Pace is a labeled even seven-calendar-day benchmark, using elapsed local dates
and the fraction of today's actual duration so DST does not move a week boundary.
The endpoint changes no classification, attribution, cancellation or Lane 2 rules.
Older Mac versions ignore the additional `week` field and continue reading today.

### Company scorecard weeks (Mac)

The optional `scorecard` extension supplies `weekdays: "monday-friday"`, the
Eastern `timeZone`, and five `weeks` in chronological order: four completed
weeks plus the current week. Each week has `start` (Monday), `end` (Friday),
`total`, five `days` entries and aggregate `coverage`. The periods match the
company scorecard (for example September 28–October 2 and October 5–9, 2026).
Weekend bookings are outside these totals. Today's daily counter continues
counting on weekends; it need not equal any scorecard day then. Friday's window
stays selected through Sunday, and a new week begins at Eastern Monday midnight.
Future weekdays are null; past days sum to each weekly total. Totals are read
from current source data, not immutable historical snapshots; delayed backfills
or reviewed call types can revise completed weeks.

The Mac now uses this extension for its 125-call goal, weekday history, completed
week copy buttons and pace: goal × elapsed weekdays / 5, capped at Friday's end.
The original `week` extension retains its Monday–Sunday behavior for older clients.
No booked-on metric, classification, attribution or cancellation policy changed.
