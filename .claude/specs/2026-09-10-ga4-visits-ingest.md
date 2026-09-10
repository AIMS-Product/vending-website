# GA4 visits ingest — slice spec

Date: 2026-09-10
Depends on: `2026-09-10-youtube-attribution.md` (shipped, `ce9e333`)

## Why

The funnel's visits stage is empty. `lead_page_views` was created at 18:00 UTC
today and is fed by a live client event, so it has no history and never will —
nobody was storing tagged visits before today.

GA4 has been recording the same thing since **2026-02-26**: 196 days, which
predates our own lead capture (2026-07-06) by four months. Its
`sessionCampaignName` values are our `utm_campaign` slugs verbatim
(`youtube-home`, `zach`, `anthony`, `diy`, `vending-machine-location`), so
they join to `youtube_videos` with no mapping layer.

## Verified against the live property before writing this

Property `526227693`, service account `ga4-reader@vendingpreneurs-ga4`, Viewer.

- 98 metrics and 375 dimensions exposed.
- `screenPageViews`, `sessions`, `engagedSessions`, `newUsers`,
  `userEngagementDuration`, `keyEvents` — all available.
- **`exits` is NOT available in the Data API.** It exists in Explorations only.
  Anything needing exits has to come from a scheduled Explorations export.
- **Watch time is not in GA4 at all.** That is the YouTube Analytics API,
  a separate product with a separate (OAuth, not service-account) auth model.
  Out of scope here.
- Full history at (date, landingPage, sessionCampaignName, sessionSource) grain
  is **15,841 rows** across all channels; 4,519 of those have a YouTube-ish
  source. Small enough to store whole.
- **The property's timezone is `America/Los_Angeles`.** GA4 `date` is a Pacific
  day, while `daysBetween` in the rollup uses UTC day keys. Noted, not
  reconciled — see Open questions.
- A same-range pull reproduces the Explorations numbers to within ~1%
  (1,964 vs 1,982 total; 9 of the top 15 campaigns match exactly). Cause of the
  gap not established. Do not present the two surfaces as identical.

## Scope

1. `ga4_page_views` table, daily grain, **all channels not just YouTube** —
   15k rows is nothing, and storing everything means the other four analytics
   tabs can use it later without a second backfill. Channel filtering happens
   in the rollup through the existing `resolveChannel`, which is the one place
   that rule lives.
2. A GA4 client: service-account JWT signed with `node:crypto`, exchanged for
   an access token, then `runReport`. No `googleapis` dependency — the whole
   auth dance is about 30 lines and the package is large.
3. A sync service that pulls a date range and upserts on the grain, so a
   re-run corrects a day rather than double-counting it.
4. A cron route, daily, pulling the last 3 days (GA4 data settles for ~48h).
5. The funnel's visits stage reads GA4 when connected, falling back to
   `lead_page_views` when it is not, and the coverage note says which.
6. A one-time backfill of all 196 days.

Only additive metrics are stored. `bounceRate` is deliberately excluded — it is
a ratio and cannot be summed across rows; `engagedSessions / sessions` derives
it correctly at read time.

## Out of scope

- YouTube Analytics API (watch time, video views, average view duration).
  Needs OAuth as a channel manager. Separate slice if Adam wants it.
- Exits. Not available through this API.
- Retiring `lead_page_views`. It stays: it is session-level and real-time,
  which GA4 is not.

## Open questions

- **Timezone.** GA4 days are Pacific; our day keys are UTC. For a daily visits
  count this is a boundary rounding difference, not a correctness bug, but if
  visits are ever joined to leads day-by-day it will matter.
- The ~1% Explorations/Data API gap. Worth one look at the response's
  thresholding metadata before anyone reconciles the two by hand.

## Status (2026-09-10, second session)

All six steps done. Migration hand-applied by Adam; backfill run through the
sync route and read back from the table: 16,330 rows, 196 days
(2026-02-26 .. 2026-09-09), 142,160 views, equal to GA4's TOTAL;
`/booking-youtube` Aug 13 - Sep 9 = 1,964 views / 1,133 sessions, matching
the live API. The very first write to the new table failed one 1,000-row
chunk (cause not logged at the time); the same run repeated three times
wrote every row. The sync now logs the PostgREST code and message.

- **Visits = GA4 `sessions`, not `screen_page_views`.** One click through to
  the site is one session however many pages it views. For `/booking-youtube`
  Aug 13 - Sep 9 that is 1,133 sessions against 1,964 views, so the tab reads
  lower than a views count in Explorations. Both columns are stored; switching
  is one line in `fetchGa4PageViews`.
- Visits read `ga4_page_views` when it has rows for the range and fall back to
  `lead_page_views` otherwise. `coverage.visitsSource` says which, and the
  coverage note names it.
- Dry-run of the full history through `client.ts`: 16,330 rows, 196 days,
  142,160 views, equal to GA4's own TOTAL. 814 rows carry campaign `(not set)`
  and are excluded from the visits read.
- **One dry-run read 1,852 views for the window instead of 1,964.** Three
  reruns and every raw-API variant (4 dimension groupings, paged and unpaged,
  with and without `newUsers`) read 1,964 with no thresholding and no `(other)`
  row. Cause not established. The client now sorts by every dimension (offset
  paging over an unordered result can repeat or skip rows) and throws when the
  rows do not sum to the report's TOTAL, so a short read fails loudly instead
  of being stored.
- `newUsers` equals the `first_visit` event count exactly (889 in the window).
  No thresholding on this property today.
- `GA4_SERVICE_ACCOUNT_JSON` (sensitive) and `GA4_PROPERTY_ID` are in
  `.env.local` and in Vercel Production + Preview.
- Cron `/api/admin/ga4-sync/run` at `40 10 * * *` UTC (3:40am Pacific), last 3
  days. `?days=200` backfills.

## Fix order

1. Migration + config env vars
2. GA4 client, with tests, no network in tests
3. Sync service, with tests
4. Cron route + vercel.json entry
5. Rollup visits source switch, with tests
6. Backfill run, then verify against the Explorations numbers
