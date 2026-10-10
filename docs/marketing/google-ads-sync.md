# Google Ads sync runbook

Account: **Vendingpreneurs, 755-564-3511** (Pacific time). The `ocid=8103800056`
in Google Ads URLs is an internal UI id, not the customer id.

## How data flows

```
Google Ads Script (scripts/google-ads/sync.js, runs inside Google Ads, daily)
  -> POST https://www.vendingpreneurs.com/api/admin/google-ads-ingest
     Authorization: Bearer <GOOGLE_ADS_SYNC_SECRET>
  -> public.google_ads_rows (upsert on report + row_key)
  -> views: google_ads_campaign_daily, google_ads_ad_daily, google_ads_creatives,
            google_ads_search_term_daily, google_ads_keyword_daily,
            google_ads_conversion_actions
```

No developer token or OAuth refresh token is involved: the script runs as the
Google Ads user who authorized it. Each run re-pulls the last 30 days, because
conversions keep landing for days after the click; upserts make that safe.

Closed-loop conversions (Close -> Google Ads) already exist and are **not** part
of this sync: `CRM - Qualified Lead` and `CRM - Closed Won` (Import from clicks,
created 2026-05-13) are fed by the Zapier link in Google Ads Data Manager. Do
not build a second uploader against those actions; it would double count.

## Secrets

| Secret                   | Lives in                                                                      | Rotate                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GOOGLE_ADS_SYNC_SECRET` | Vercel production env + the `SYNC_SECRET` line of the saved Google Ads script | `openssl rand -hex 32`, set in Vercel, redeploy, paste into the script, Save. Old value stops working on redeploy. |

Missing secret = the endpoint answers 503 (fails closed).

## Setup (one time)

1. Apply `supabase/migrations/20261009120000_google_ads_rows.sql` in the
   Supabase SQL editor (safe to run twice).
2. Set `GOOGLE_ADS_SYNC_SECRET` in Vercel production; deploy.
3. Google Ads > Tools > Bulk actions > Scripts > New script. Paste
   `scripts/google-ads/sync.js`, set `SYNC_SECRET`, Authorize (the account
   owner does this), Preview. The log prints row counts per report.
4. Save, then Frequency: Daily, 6am.

## Backfill

Set `DAYS = 90` in the script, Run once, set it back to 30. Google Ads keeps
search terms and asset metrics for a limited window; older days come back empty.

## What breaks and how you'd see it

- **Script authorization revoked** (the authorizing user loses access or
  removes the app): the scheduled run fails; Google Ads emails the script
  owner. Re-authorize from the Scripts page.
- **Secret mismatch**: every batch is rejected with HTTP 401 and the run ends in
  `Google Ads sync failed for: ...`.
- **Table missing**: HTTP 500 "Could not store the batch."
- A report that errors (for example a field Google deprecates) fails alone;
  the other reports still sync and the run is marked failed.

## Reconciling

`select sum(cost), sum(clicks), sum(conversions) from google_ads_campaign_daily
where day between '<from>' and '<to>'` must equal the Campaigns page for the
same dates, to the cent for cost.

## Booked calls are the bidding target

Proof (2026-08-01 to 2026-10-09, `lead_submissions` x `channel_daily`): Google
paid search produced 293 site leads, 150 booked calls (51%), 8 wins, $59,376
on $27,851 spend: $186 per booked call. VP | Brand: $602, 21 booked, $29 per
booked call, $12,594 won (it stopped serving mid-September). Web Retargeting:
$1,666, 0 booked. 308 of 309 Google leads carry a click id in our database.

How Google learns from bookings:

- `GET /api/admin/google-ads-booked-calls?days=N` (bearer
  `GOOGLE_ADS_SYNC_SECRET`) lists booked calls with a gclid
  (`src/lib/services/google-ads-booked-calls.ts`: one per gclid, noon Pacific
  on Close's booked date, never before the lead, bookings made before the
  click left out).
- `scripts/google-ads/upload-booked-calls.js` uploads them to
  **CRM - Booked Call** (Import from clicks). Backfill `DAYS = 90` once, then
  `DAYS = 7` daily. Google ignores exact re-uploads.
- `scripts/google-ads/setup-booked-calls.js` creates that action and sets the
  goals. Run 1 keeps the lead form as a bid signal; Run 2 (`BOOKINGS_ONLY =
true`, after the backfill shows) bids on booked calls, qualified and won only.
- The site also sends `vp_call_booked` to GA4 on every on-site booking
  (`src/lib/tracking/booked-call.ts`); the Ads web tag there stays off unless
  `NEXT_PUBLIC_GOOGLE_ADS_BOOKED_CALL_SEND_TO` is set. Do not set it while
  CRM - Booked Call is primary: the same booking would count twice.
