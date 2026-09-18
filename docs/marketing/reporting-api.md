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
