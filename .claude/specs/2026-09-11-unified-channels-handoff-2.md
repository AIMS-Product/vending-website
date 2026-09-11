# Handoff 2: unified channel reporting, Slices 3 to 6

Written 2026-09-11 after Slices 0, 1, 2 landed on branch `feat/unified-channels`
(three commits, one per slice, suite green at 264 files / 2142 tests, tsc clean).
Parent spec: `2026-09-11-unified-channel-reporting-handoff.md`. Read it first,
then this.

## Decisions Adam made this session

- Closed lists = spec list **plus `x` and `affiliate`**. Live in
  `src/lib/analytics/link-standard.ts` and `docs/marketing/link-standard.md`.
- Admin login is enough auth for the link builder. `created_by` = admin email.
- GHL v2 key and Metricool key are ready; YouTube OAuth is not.
- **The GHL key was pasted into chat on 2026-09-11.** It was NOT used or written
  anywhere. Adam must rotate it in GHL and paste the new one straight into
  `.env.local` (`GHL_API_KEY`, `GHL_LOCATION_ID`) and Vercel. Same for Metricool
  (`METRICOOL_API_KEY`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID`).

## What exists now (do not rebuild)

| Piece                                                                                             | Where                                                                                                          |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Link standard, `resolveDestination`, `checkLinkStandard`                                          | `src/lib/analytics/link-standard.ts`, `channel.ts`                                                             |
| `/admin/links` builder + `marketing_links` (optional Bitly mint)                                  | `src/app/admin/links/`, `src/components/admin/MarketingLinkBuilder.tsx`, `src/lib/services/marketing-links.ts` |
| Spine writers: `channelDailyKey`, `upsertChannelDaily`, `recordSyncRun`                           | `src/lib/services/channel-daily.ts`                                                                            |
| Connectors ga4-visits / bitly-clicks / leads                                                      | `src/lib/services/channel-sync.ts`, cron `/api/admin/channel-sync/run` daily 11:10Z                            |
| GA4 report keyed on all five UTMs                                                                 | `Ga4Client.fetchChannelSessions`                                                                               |
| Bitly sync now also claims `marketing_links` short links                                          | `bitly-click-sync.ts`                                                                                          |
| Report rollup (pure) + service                                                                    | `channel-report-rollup.ts`, `channel-report.ts` (`getChannelsTab`)                                             |
| Channels tab (funnel, per-channel table, drill by campaign/content/destination, connector health) | `src/components/admin/ChannelsPanels.tsx`, wired in `analytics/page.tsx`                                       |
| Webinar receiver                                                                                  | `POST /api/admin/webinar-ingest`, `webinar-ingest.ts`, table `webinar_events`                                  |
| Migrations, NOT yet applied to prod                                                               | `20260911120000_marketing_links.sql`, `20260911130000_channel_daily.sql`, `20260911140000_webinar_events.sql`  |

Conventions every new connector must keep:

- Write through `upsertChannelDaily` with only the metric columns it observed.
  Null means not observed. Never a zero for an unobserved value.
- Wrap the run in `recordSyncRun(client, "<connector>", ...)`. Return
  `skipped("reason")` from `channel-sync.ts` when the key is absent, so the
  health row shows "Not connected" (amber) rather than "Failed" (red).
- Add the connector name to `EXPECTED_CONNECTORS` in `channel-report.ts`.
- Read-only against the external system. Real `User-Agent` header on GHL.
- Migration + `src/lib/<source>/client.ts` + `/api/admin/<source>-sync/run` +
  cron in `vercel.json` + Vitest with recorded fixtures. Copy `ga4-sync`.
- `pnpm exec` is broken in this checkout (deps-status check fails). Use
  `./node_modules/.bin/{tsc,vitest,prettier,eslint,next}` directly.
- `src/types/database.ts` is hand-maintained. New tables go inside
  `public.Tables`; insert before the `      ga4_page_views: {` line.

## Slice 3: GoHighLevel v2

Env: `GHL_API_KEY` (private integration token, `pit-...`), `GHL_LOCATION_ID`.
Add both to `config.ts`. Verify endpoints with context7 before coding; do not
guess. Pull per day, per workflow/campaign, for SMS and email: sent, delivered,
replied, clicked; plus lander form submissions. Write `channel_daily` rows with
source `ghl_sms` / `ghl_email`, medium `sms` / `email`, campaign = workflow
slug, content = step id; metrics `impressions` (sent), `clicks`. Store the raw
per-message stats in a `ghl_message_stats` table if needed for drill-in.
Cloudflare returns 1010 without a real `User-Agent` (learned in vp-webinars).

## Slice 4: Metricool

Env: `METRICOOL_API_KEY`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID`. Per post
per network: published_at, reach, impressions, clicks, link. Table
`metricool_posts` (post id PK, network, published_at, link, reach, impressions,
clicks, utm_* parsed with `parseLinkUtms`, `link_check` from
`checkLinkStandard`). Write `channel_daily` (impressions, reach, clicks) keyed
on the UTMs off the link; a post with no standard UTMs still writes under
`(not set)` / `unknown`. The **Fix these links** panel reads
`metricool_posts` where `link_check.compliant = false`, plus Bitly clicks whose
long URL fails `checkLinkStandard`.

## Slice 5: YouTube Analytics API

OAuth as channel owner: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`YOUTUBE_REFRESH_TOKEN`. Ship a small script to obtain the refresh token once.
Per video per day: views, impressions, CTR, end-screen / card clicks. Join to
`youtube_videos.video_id`; write `channel_daily` with source `youtube`,
content = video id, `impressions` and `clicks`. Degrades to `skipped` without
the token.

## Slice 6: finish the Channels tab

Already there: funnel, per-channel rows with deltas, drill-in, connector
health. Still to add on the tab:

- **Going out** table: `marketing_links` joined to `bitly_link_clicks` in
  range, so a link with zero clicks still appears.
- **Fix these links** panel (see Slice 4).
- Keep the tab under three viewport screens.

## Rollout, in order

1. Apply the three migrations to prod Supabase.
2. Set `WEBINAR_INGEST_SECRET` in Vercel; Adam sets the same value plus
   `WEBINAR_INGEST_URL=https://www.vendingpreneurs.com/api/admin/webinar-ingest`
   in vp-webinars GitHub Actions secrets. Confirmed secret name:
   `WEBINAR_INGEST_SECRET`.
3. Merge `feat/unified-channels` into `main` (this repo has no PR flow gating
   it; a push to main deploys). Verify on the `*.vercel.app` URL first.
4. Backfill once: `GET /api/admin/channel-sync/run?days=400` with the
   `CRON_SECRET` bearer. Then dispatch vp-webinars `refresh snapshots` once and
   watch the `webinar-ingest` row turn green on the Channels tab.
5. Then Slices 3, 4, 6, 5, one commit each.

## Open gaps to tell Adam about

- Revenue is null for every channel except webinars: the Close reconciler
  reads opportunity `value` but does not store it. One column + one line in
  `close-booking-reconcile.ts` fixes it; it touches the Close path, so verify
  on preview.
- Non-webinar Meta spend and all Google Ads spend have no pull.
- Ecosystem map published as a private page:
  https://claude.ai/code/artifact/93321766-4def-4381-9960-dc3e2b8d81c9
  FigJam version: https://www.figma.com/board/iGNIgllcEBdKjVrbIm9mee
  Update both as slices land. A Google Doc copy needs Adam to run `/mcp` and
  authorise Google Drive first.

## Landed 2026-09-11 (later the same day)

Slices 6a, 3, 4, 5 committed one per slice, then the whole stack cherry-picked
onto `feat/unified-channels-main` (from `main`) because `main` had moved by five
squashed PRs. PR #32. Suite 270 files / 2179 tests, tsc clean, `next build`
passes.

- 6a `Going out`: `buildGoingOut` in `channel-report-rollup.ts`; links without a
  short link show clicks as not observed.
- 3 GHL: `src/lib/ghl/client.ts`, `ghl-sync.ts`, connectors `ghl-email`
  (daily snapshot in `ghl_email_stats`, day-over-day into the spine as
  impressions = sent, clicks = clicked, campaign = workflow slug) and
  `ghl-forms` (form submissions as leads, source `ghl_form`). SMS per workflow
  is not exposed by the API; see AGENTS.md Learnings.
- 4 Metricool: `src/lib/metricool/client.ts`, `metricool-sync.ts`, connector
  `metricool-posts`, table `metricool_posts`, `Fix these links` panel on the
  Channels tab (posts whose outbound URL fails `checkLinkStandard`). Bitly
  half deliberately omitted: only registry links have click rows, and the
  YouTube registry predates the standard by design.
- 5 YouTube Analytics: `src/lib/youtube-analytics/client.ts`,
  `youtube-analytics-sync.ts`, connector `youtube-analytics`, table
  `youtube_video_daily`, `scripts/youtube-oauth-token.mjs` (run with
  `node --env-file=.env.local`). Needs a Desktop-app OAuth client:
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, then
  `YOUTUBE_REFRESH_TOKEN`.

Migrations still to apply to prod, in order: `20260911150000_ghl_email_stats`,
`20260911160000_metricool_posts`, `20260911170000_youtube_video_daily`.

Vercel Production is missing every connector secret except `CRON_SECRET`:
`WEBINAR_INGEST_SECRET`, `GHL_API_KEY`, `GHL_LOCATION_ID`, `METRICOOL_API_KEY`,
`METRICOOL_USER_ID`, `METRICOOL_BLOG_ID`, `GOOGLE_OAUTH_*`,
`YOUTUBE_REFRESH_TOKEN`, and also `GA4_SERVICE_ACCOUNT_JSON`,
`GA4_PROPERTY_ID`, `BITLY_ACCESS_TOKEN`, `BITLY_GROUP_GUID` (GA4 and Bitly
syncs have been skipping in prod). A GHL key and a Metricool token were both
pasted into chat on 2026-09-11; neither was used. Both must be rotated.
