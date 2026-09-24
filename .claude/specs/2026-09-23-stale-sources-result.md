# Stale sources: result (2026-09-23, PR #71 merged e96d508, live)

Root causes (prod, read-only):
- Metricool posts: UTM count stored in channel_sync_runs.error -> every run "failed" since 09-19; also the connector-health fail. Fixed; clears at next 11:30 UTC run.
- Bitly: 0 rows ever in bitly_link_clicks; BITLY_ACCESS_TOKEN/BITLY_GROUP_GUID unset in Vercel prod AND empty in .env.local. Now reads "not connected".
- ManyChat: 0 rows ever in manychat_events; the 09-11 run is our own test. Now "not connected".
- Calendly check: replay of 09-16..09-22 with #42 logic = 221 vs 221. Real 09-24 12:30 UTC run still to confirm.

Owed / open:
- Verify 09-24 audit: calendly-bookings + connector-health pass; Channels bar dated today.
- Adam: Bitly generic token + group guid into Vercel prod/preview + .env.local, redeploy, `bitly-sync/run?days=90&batchSize=400` twice. Do NOT run channel-sync?days=N (GA4 wide report folds into (other)).
- Mike: ManyChat External Request per docs/marketing/manychat-ingest.md.
- Optional: thank-you visits blank before 09-18 -> channel-visits-repair.mjs (needs GA4 creds locally).
- Instagram grey bar after "46 -28%": not reproducible from code/prod data/prod CSS at 1080 and 1500px; need Adam's screenshot.
- Coverage recs: Bitly (YouTube + bio clicks), Search Console (Organic search), ManyChat; not worth: Chatbot/Braze/Affiliate/Trustpilot/owned funnels. Junk channels: Localhost:3000, Phcheck (GA4 dev traffic).

## Later 09-23: three more PRs merged, all live
- #72 Search Console connector (5820647): source `google-search-console` -> Organic search Seen/Clicked; env `GSC_SITE_URL`; backfill `search-console-sync/run?days=480`. Trust bar: only-ever-skipped feed = not connected. Until its first run, the bar reads it red "no successful update" (never ran) — clears after Adam's backfill or the 11:50 UTC cron.
- #73 orphan checks spend/visits/leads/clicks/won (859aa6b): all pass on prod 09-23; also fixed non-unique paging in clearSupersededGa4Metrics / clearMovedBookingRows.
- #74 Channels polish (9381cf0): 5-tile KPI row, no-wrap cells, localhost + own vercel previews excluded as internal (objection-library.vercel.app kept as Referral); includeInternal consistent on KPI + Funnel map. "Phcheck" source unknown.
- Next session: verify 09-24 12:30 UTC audit (calendly, connector-health, 5 new orphan checks); GSC data landed if Adam finished setup.

## Search Console connected (09-24 00:20 UTC)
- GSC_SITE_URL=sc-domain:vendingpreneurs.com set in Vercel prod + preview + .env.local; prod redeployed.
- Service account ga4-reader@vendingpreneurs-ga4.iam.gserviceaccount.com added Restricted; Search Console API enabled in GCP project 1006742544160 (first run 403'd until enabled).
- Backfill days=480: 300 rows, 2025-11-26..2026-09-21 (property has nothing earlier). 30d: 7,627 impressions, 703 clicks vs GA4 organic visits 1,385 (GA4 last-non-direct attribution + other engines; different counts, kept on separate source).
- Nightly cron 11:50 UTC keeps it current.

## Open for next session
1. Verify 09-24 12:30 UTC audit: calendly-bookings, connector-health, 5 spine-orphaned-* checks pass; Channels bar dated today (Metricool clears after 11:30 UTC run).
2. Bitly: needs account owner -> generic token + group guid (steps above).
3. ManyChat: Mike adds External Request actions (docs/marketing/manychat-ingest.md).
4. Instagram grey bar: waiting on Adam's screenshot.
5. "Phcheck" channel source unknown.
