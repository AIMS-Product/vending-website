# UTM master sheet -> link registry (2026-10-14)

Goal: retire Jess's "MARKETING SALES OPS" Google Sheet. Every link, its funnel and
its results live in `/admin/links`; Dom reads the same data over the reporting API.

## Findings (2026-10-13)

- Sheet: 273 distinct tagged links (292 rows). 29 already in `marketing_links`.
- Sheet links explain 16% of tagged leads (179/1,117) and 29% of tagged bookings.
- Funnel is a per-link fact: the sheet maps `newsletter` to both Internal Webinar and
  VSL and `meta` to both Meta Ads and VSL, so a source-level mapping is wrong.
- Canonical funnel list = Close "Funnel Name DEAL (Opp)" choices (35 values).

## Slices

1. Migration: `funnel_name`, `funnel_set_by`, `owner` on `marketing_links`.
2. Builder: funnel (required, Close list) + owner on new links. Registry: funnel
   on each row, funnel filter, "No funnel" filter, edit funnel/owner/note in place.
3. `GET /api/reporting/links` (bearer REPORTING_API_KEY), JSON or `?format=csv`.
4. `scripts/import-utm-sheet.py`: dry run writes a plan; `--apply` inserts sheet
   links as `backfill:sheet` and fills funnel/owner/note on existing rows only
   where empty. Funnel order: sheet's own Funnel Name (mapped to Close list), then
   Close evidence (>=2 leads, >=60%, ignoring Reactivation Scrapers / No
   Attribution), then `youtube`->YouTube, google cpc->Google Ads. Never overwrites.

## Deploy order

Adam pastes the migration in the SQL editor -> merge -> run the import `--apply`.

## Not doing (yet)

- Nightly auto-registration of new tagged links: coverage page lists them; add when
  the "missing" list stops being reviewed.
- Weekly content calendars / newsletter tabs: content plans, not links.
- HubSpot UTM Export tab: legacy PII, never imported.
- Using the registry in booked-calls V2 `sources.ts` (PR #169 branch): follow-up.
