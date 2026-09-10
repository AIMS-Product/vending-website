# YouTube attribution and per-video funnel

Date: 2026-09-10
Requested by: Kody Wirth (VP marketing) via Adam
Status: in progress

## Why

YouTube is the top channel: 244 of 941 captured leads (26%), 155 of which booked
a call and 16 of which are Closed / Won in Close. Today the admin can see that a
lead came from YouTube but not which video produced it, cannot see clicks or
visits at all, and has no date on a closed deal, so "time to close" cannot be
computed for any channel.

## Verified starting state (probed production 2026-09-10, read-only)

- `lead_submissions.utm_campaign` is captured on every path and is 100% populated
  on YouTube leads. No capture work is needed.
- 43 distinct YouTube campaigns have produced leads. 42 join cleanly to the
  Master Registry; `vending-machine-location` is a truncated
  `vending-machine-location-strategy`.
- Registry holds 646 videos, 609 redirect-verified and in-description, 604 with a
  Bitly URL.
- `call_booked_at` (date) is mirrored from Close. `call_status` carries the live
  Close label including `Closed / Won` (50 site-wide, 16 YouTube) and `No Show`
  (66) but has no timestamp.
- Only 195 of 244 YouTube leads submit on `/booking-youtube`; grouping YouTube by
  landing page undercounts it by 20%. Group by `utm_source`.
- `public_request_hits` is rate-limit only (24h retention, migration not applied)
  and attribution events are forwarded to an external ingest with no readback, so
  there is no queryable pageview store.
- `buildTopCampaigns` (admin-analytics-detail.ts) is CORRECT. It reads as broken
  through `sed`/`grep`, which render its separator as a space, but the separator
  and the split are both a literal NUL byte. Replaced with the `\u0000` escape so
  the file stops registering as binary and misleading the next reader.
- `resolveChannel` had a real gap: `yt` and `fb` were in the person-tag suffix
  map but not the exact map, so a bare `yt` tag opened its own "Yt" channel
  instead of rolling into YouTube. Fixed in `src/lib/analytics/channel.ts`.

## Slices

1. Registry mirror + per-video funnel tab, on data we already hold.
   Leads -> qualified -> booked, per video, with titles and publish dates.
2. Close closed-won date + call outcome. Unblocks close rate, time-to-close and
   the cohort close-month split. Touches `src/lib/close/*` - Tier 1, verify on
   preview against the real Close org before it reaches production.
3. Bitly click sync (the clicks stage).
4. Landing-page visits from the `landing_viewed` event already being emitted.
5. YouTube Data API v3 for views and click-through rate. Deferred, needs a key.

## Decisions

- Join key is `utm_campaign`, not the video URL. It is what the lead row already
  carries and it matches the registry 42/43.
- `closed_won_at` provenance is recorded in `closed_won_source`. Only
  `close_opportunity` rows feed time-to-close; a date we merely observed when the
  status label flipped would fabricate the metric for the 50 leads already marked
  won. The UI states how many rows are excluded.
- `call_outcome` records only what a Close label actually asserts (no_show,
  canceled, rescheduled, won, contract_sent). "Attended" is derived as booked
  minus no-show minus canceled and is labelled as a derivation in the UI.
- Visits are deduped to one row per session per path per day, so a refresh does
  not inflate the top of the funnel.
- New tables are service-role only (RLS on, no policies), matching
  `public_request_hits`. The analytics reads already use the admin client.

## Release

Local commits only. No push, no PR, no preview until Adam picks the slice, per
the release-train rules in AGENTS.md.
