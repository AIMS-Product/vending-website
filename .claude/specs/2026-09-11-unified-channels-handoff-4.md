# Handoff 4: finish the unified channel reporting

Written 2026-09-11 night after commits b49f7b7..5bd4f79 shipped to `main`
(deploy if0rffnth). Read `2026-09-11-spine-rekey-paid-medium.md` and
`2026-09-11-kpi-framework-tab.md` first. Conventions unchanged:
`./node_modules/.bin/*` (never `pnpm exec`), one slice per commit, suite green,
null means not observed, keys in `.env.local` and Vercel only, never ask for
a key in chat, never infer `utm_term`.

## Live state (verified in prod 2026-09-11 ~16:45 PT)

- `channel_daily` keyed on the six link dimensions; 0 doubled keys; 400-day
  backfill green (ga4 12,776 rows, leads 698). Trigger keeps Webinar labels.
- Channels tab, KPI tab (`?tab=kpi`), `/api/reporting/channels` and
  `/api/reporting/kpi?format=csv` deployed. The two API routes answer 503
  until `REPORTING_API_KEY` exists in Vercel.
- 30d by channel: Webinar L3763 B205 · YouTube L156 B113 W12 · Google Ads
  L137 B74 W4 · Website L125 B78 W8 · Instagram L60 B65 · Chatbot L40 B27.
- Artifact https://claude.ai/code/artifact/93321766-4def-4381-9960-dc3e2b8d81c9
  is at version 5 and current.

## Adam does (no code)

1. `REPORTING_API_KEY`: `openssl rand -hex 32` into `.env.local` and Vercel
   Production + Preview (`--sensitive`). Redeploy. Then
   `curl -H "Authorization: Bearer $KEY" https://www.vendingpreneurs.com/api/reporting/kpi?format=csv`
   must return CSV.
2. Bitly Generic Access Token + group guid → `BITLY_ACCESS_TOKEN`,
   `BITLY_GROUP_GUID`, then `GET /api/admin/bitly-sync/run` with `CRON_SECRET`.
3. YouTube Analytics: `GOOGLE_OAUTH_CLIENT_ID/SECRET`, run
   `node --env-file=.env.local scripts/youtube-oauth-token.mjs`, store
   `YOUTUBE_REFRESH_TOKEN`, redeploy, `GET /api/admin/youtube-analytics-sync/run?days=90`.
4. Retag live links at `/admin/links` with `utm_term` (book-call, lead-magnet,
   webinar-register, apply). Until then every KPI channel is one row.
5. Mike adds the ManyChat External Request actions (`docs/marketing/manychat-ingest.md`).
6. Decide: Fix-these-links host filter (only vendingpreneurs.com hosts?).
7. Confirm which tool sends the newsletter.

## Code slices for the next session, in order

1. **Google Ads key mismatch.** Leads carry the Ads campaign _id_
   (`utm_campaign=23805931083`), GA4 reports the campaign _name_, so visits
   and leads for the same ad never share a spine key and every paired rate
   for Google Ads is null or skewed. Pick one: either the GA4 connector maps
   `sessionCampaignId` (add the dimension, key on it when source is google
   with a paid medium) or the URL template switches to `{campaignname}`.
   Prefer the GA4 side: no ad edits needed. Verify: Google Ads opt-in and
   lead → book on the KPI tab become non-null.
2. **Thank-you page visits.** Add a GA4 page-path report for `/thank-you*`,
   `/thank-you-for-applying`, `/booked*` grouped by session UTMs; write as a
   new nullable spine metric `thankyou_visits` (migration + types inside
   `public.Tables`, insert before `      ga4_page_views: {`). KPI section 1
   gains "Thank-you visits" and "Conv %" columns.
3. **Revenue per lead.** The Close reconciler reads opportunity value but
   does not store it. Add `lead_submissions.closed_won_value numeric`, mirror
   it, and have the leads connector write `revenue`. Cost / booked and
   revenue columns stop being null outside webinars.
4. **Stored labels lag.** Old-day rows still say `Ghl Form`, `Google`,
   hostnames, because connectors rewrite only recent days. Harmless (read
   time normalises) but a one-off `?days=400` run of ghl-sync after the
   forms connector gains a `days` option cleans it. Low priority.
5. **Re-engagement check on 09-12.** After the second GHL snapshot lands,
   confirm the KPI re-engagement section shows workflows with sends, and the
   Channels tab Email row has Seen and Clicked.

## Verify before saying done

`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`,
`./node_modules/.bin/eslint`, `npm run build`; then push, confirm the deploy
on `vercel ls --prod --scope aimanagingservices`, and look at
`/admin/analytics?tab=kpi` in Adam's Chrome via browser-harness
(`new_tab`, `wait_for_load`, `capture_screenshot(path, full=False, max_dim=1400)`,
then `sips -Z 720 -s format jpeg` before reading). Paste real numbers.

## Gotchas hit today

- Supabase SQL editor: a table created by one statement is not visible to
  the next. Put multi-step data migrations in one `do $$ … $$` block.
- The auto-mode classifier blocks: writing secrets to `.env.local`/Vercel,
  bulk `rm -rf` loops across repos (one repo per call is fine), and
  sometimes reads that combine `.env.local` with a network call. Retry
  inline; do not work around it.
- `rg` output is mangled by the rtk hook; use `/usr/bin/grep` for anything
  you reason on. `echo =====` breaks zsh (treated as `=` expansion).
- Disk: `.next` folders across ~/ repos are the fast reclaim; Adam approved
  deleting them. `sendmore-outbound` has a live dev server.
