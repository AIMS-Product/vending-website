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
Aggregates only, no names, emails or lead ids.

## Example

```
curl -s -H "Authorization: Bearer $REPORTING_API_KEY" \
  "https://www.vendingpreneurs.com/api/reporting/channels?range=90d" | jq '.report.rows[] | {channel, leads, booked}'
```

For an agent (Claude Code, Codex, a custom tool): give it the URL and the key
as an environment variable and tell it to fetch with the bearer header. There
is no query-string key on purpose: it would end up in logs.

## Key

`REPORTING_API_KEY` in `.env.local` and Vercel (Production and Preview).
Rotate by replacing it in both places and redeploying; nothing else depends
on it. Missing key answers 503, wrong key 401.
