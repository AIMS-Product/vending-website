# KPI tab: the Lead Gen KPI Framework, filled from the spine

2026-09-11. Adam shared two sheets ("Lead Gen KPI Framework" and a per-channel
funnel sheet) and asked for "SUPER CLEAN reporting for what we care to see".
Approved: a KPI tab that renders the framework's four sections, plus a CSV
flavour of the reporting API so the Google Sheet can pull it.

## Sections and their data

| Section                     | Row                                        | Source                                               |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| Content and website funnels | channel x CTA path (`destination`)         | `channel_daily`                                      |
| Webinar funnel              | one webinar event                          | `webinar_events`                                     |
| Marketing re-engagement     | one GHL workflow, plus Email+SMS spine row | `ghl_email_stats` snapshots, `channel_daily`         |
| Lane 2 (setters)            | one setter, plus Instagram DM              | `lead_submissions.booked_by_setter`, `channel_daily` |

Columns follow the sheet: reach, CTR, landing page visits, opt-in %, leads,
lead -> book %, first booked calls, show rate, calls shown, close rate, closed
won, lead -> close %, revenue, spend, cost per booked call, source of truth,
owner, cadence, last verified. Owners and cadence are a static map
(`KPI_OWNERS`) taken from the sheet.

## Honesty rules (unchanged from the Channels tab)

- Null is "not observed", rendered as a dash, never zero. Revenue is null
  everywhere except webinars until Close deal values are synced.
- Every rate is paired: computed only over rows where both sides were observed.
- Section 1 credits booked / shown / won to the lead's cohort day (the spine's
  basis). Section 4 uses the booking date (`call_booked_at`), which is the
  sheet's "First Sales Call Booked Date" basis. Each section states its basis.
- Thank-you page visits are not observed yet: GA4 is pulled by landing page,
  not page path. Listed as a follow-up, not faked.

## Slices

1. `kpi-report.ts` (pure): `buildKpiReport`, `kpiReportToCsv`, `KPI_OWNERS`.
2. `kpi-report-data.ts`: `getKpiTab` fetching the four inputs.
3. `KpiPanels.tsx` + tab entry + page wiring.
4. `GET /api/reporting/kpi?range=&format=json|csv`, same bearer key.
5. Docs: reporting-api.md gains the KPI endpoint and the Apps Script line.

## Follow-ups

- Thank-you page visits: add a GA4 page-path report for `/thank-you*` and
  `/booked*` paths, write to the spine as a new metric or a per-destination row.
- Revenue: Close opportunity values into `lead_submissions` (or a deals table).
- Registration page visits for webinars: the page is GHL-hosted, no GA4.
