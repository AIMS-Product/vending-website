# Handoff 3: make every channel correct, not just live

Written 2026-09-11 evening. Everything from handoff-2 is merged to `main` and
running in production (PR #32 plus fixes 4d89e09, 77f7f6b and the GHL webinar
form skip). Read `2026-09-11-unified-channels-handoff-2.md` (section "Landed")
first, then this. Conventions unchanged: `./node_modules/.bin/*`, one slice per
commit, suite green, null means not observed, keys in `.env.local` and Vercel
only. Every value below already sits in `.env.local`; never ask for one in chat.

## Live state (verified against prod Supabase, 2026-09-11 ~19:00Z)

| Connector         | State                                                        |
| ----------------- | ------------------------------------------------------------ |
| ga4-visits        | Synced, 12,759 rows over 400 days                            |
| leads             | Synced, 682 rows                                             |
| ghl-forms         | Synced; webinar registration forms now skipped (see 2)       |
| ghl-email         | 63 workflows snapshotted; day-over-day rows start 2026-09-12 |
| metricool-posts   | 901 posts, Vendingpreneurs brand only, YouTube + Facebook    |
| webinar-ingest    | Green: 10 webinars, 30 audience rows                         |
| bitly-clicks      | 0 rows, waiting on `BITLY_ACCESS_TOKEN` + `BITLY_GROUP_GUID` |
| youtube-analytics | Skipped until `YOUTUBE_REFRESH_TOKEN`                        |

## 1. Metricool: three brands, and Instagram is missing

The user token sees three brands (from `GET /v2/settings/brands`):

| blogId  | Brand             | Connected                                                           |
| ------- | ----------------- | ------------------------------------------------------------------- |
| 6626386 | Vendingpreneurs   | facebook, instagram, linkedin, gbp, youtube, facebookAds, googleAds |
| 6633336 | Mike Hoffmann     | facebook, instagram, twitter, linkedin, tiktok                      |
| 6633345 | Anthony Kolodziej | facebook, instagram, twitter, linkedin, tiktok, facebookAds         |

Only 6626386 is pulled today, and `brand-summary/posts` returned only
`youtube` and `facebook` for it although Instagram and LinkedIn are connected.

Adam's direction (2026-09-11): pull ALL data from all three brands, every
connected network, with history back as far as Metricool returns (use
`days=400`). Do, in order:

- Probe with the real key (never print it): call
  `/v2/analytics/posts/instagram`, `/v2/analytics/reels/instagram`,
  `/v2/analytics/posts/linkedin`, `/v2/analytics/posts/tiktok` for
  blogId 6626386 and 6633336 over the last 30 days. Record which return rows
  and their metric field names (the typed schemas are in
  `scratchpad/metricool-swagger.json` from this session if still present, else
  re-download `https://app.metricool.com/api/swagger.json`).
- Replace the single brand-summary call in `src/lib/metricool/client.ts` with
  per-network typed endpoints where brand-summary omits a network. Keep the
  tolerant `readMetric` and the raw `metrics` jsonb.
- `METRICOOL_BLOG_IDS=6626386,6633336,6633345` (comma list; keep
  `METRICOOL_BLOG_ID` as fallback). Loop brands in `metricool-sync.ts`.
- Person brands must keep their owner: for blogId 6633336 write source
  `mike-<suffix>`, for 6633345 `anthony-<suffix>`, where suffix follows
  `SUFFIX_CHANNEL` in `src/lib/analytics/channel.ts` (`ig`, `fb`, `li`, `tt`,
  `x`, `yt`). `resolveChannel` then yields channel + person like the existing
  `mike-ig` / `anthony-li` lead tags. Vendingpreneurs posts keep plain network
  sources. Add `brand_id text` to `metricool_posts` (migration + types).
- Metricool brand-summary metrics come back as uppercase keys
  (`IMPRESSIONS`, `ENGAGEMENT`, `INTERACTIONS`) with nulls for Facebook.
  `readMetric` is case-insensitive, so impressions already land; reach and
  clicks are only available from the typed per-network endpoints.
- Fix-these-links: the two flagged posts link to evending.com and
  micromart.com (mentions, not CTAs). Ask Adam whether to only check links
  whose host is vendingpreneurs.com or booking.vendingpreneurs.com. One-line
  filter in `postRow` if yes.

## 2. Webinar double count (done; delete ran 2026-09-11 evening, verify the tab)

GHL forms `general-2026-webinar-registration-form` (4,027 leads/30d) and
`webinar-intake-form` (827) are registrations already counted under channel
Webinar by the vp-webinars push. `ghl-sync.ts` now skips any form whose name
matches `/webinar/i` (`WEBINAR_FORM_PATTERN`). The already-written `ghl_form`
rows for those two campaigns are STILL IN `channel_daily`: the delete was
blocked by the tool permission classifier. Adam runs this in the Supabase SQL
editor (or a session with delete permission does):

```sql
delete from public.channel_daily
where source = 'ghl_form'
  and campaign in ('general-2026-webinar-registration-form', 'webinar-intake-form');
```

Then verify on the Channels tab that "Ghl Form" leads dropped to roughly 900/30d
(checklist, VSL, financial templates, lead-scoring, waitlist forms). If Adam
wants those remaining forms attributed to a real channel, they need UTMs on the
GHL form page, which the GHL API does not expose per submission; leave them as
`ghl_form` and say so.

## 3. Bitly

When `BITLY_ACCESS_TOKEN` and `BITLY_GROUP_GUID` are non-empty in `.env.local`:

```
for k in BITLY_ACCESS_TOKEN BITLY_GROUP_GUID; do v=$(grep "^$k=" .env.local | cut -d= -f2-); printf '%s' "$v" | vercel env add "$k" production --sensitive; done
vercel redeploy <latest prod url from: vercel ls --prod> --scope aimanagingservices
```

Then, with `CRON_SECRET` from `.env.local` (already unquoted) as the bearer:
`GET /api/admin/bitly-sync/run` (claims links, pulls 30 days of clicks) then
`GET /api/admin/channel-sync/run?days=400`. Expect `bitly-clicks` rows > 0 and
the Going out table to show click counts.

## 4. YouTube Analytics OAuth

Adam creates a Desktop-app OAuth client (YouTube Analytics API enabled), adds
`GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` to `.env.local`, runs
`node --env-file=.env.local scripts/youtube-oauth-token.mjs`, adds the printed
`YOUTUBE_REFRESH_TOKEN`. Push all three to Vercel, redeploy, run
`GET /api/admin/youtube-analytics-sync/run?days=90`. If GA4-style 400s appear
for `videoThumbnailImpressions`, the client already falls back to core metrics.

## 5. Vercel gotchas hit tonight

- `vercel env pull` returns non-sensitive values in double quotes and sensitive
  ones as `""`; strip quotes before use, and never judge a sensitive var by
  pulled length.
- `vercel redeploy` and `vercel inspect` need `--scope aimanagingservices`.
- `vercel env add` from stdin: a value copied with its `.env.local` single
  quotes is stored with the quotes and JSON.parse fails (GA4 hit this).
- Metricool ids in `.env.local` had leading spaces; trimmed. Re-push
  `METRICOOL_USER_ID` and `METRICOOL_BLOG_ID` with the Bitly push.

## 6. Docs to flip to Live

Artifact https://claude.ai/code/artifact/93321766-4def-4381-9960-dc3e2b8d81c9
(source: this session's scratchpad `channel-map.html`, or re-read the artifact)
still says GHL / Metricool / webinar receiver are pending. Google Doc
https://docs.google.com/document/d/1GQjTm7SJ7gthQTeyXBl-0Z0gDlPhAFnOI0nHVmRXEUY
needs the same edits; the Drive connector cannot edit body text, so paste or
ask Adam to authorise Docs editing. FigJam
https://www.figma.com/board/iGNIgllcEBdKjVrbIm9mee unchanged.

## Prompt for the fresh session

> Read .claude/specs/2026-09-11-unified-channels-handoff-3.md and do sections
> 1, 3 and 6 in that order, then 4 if the OAuth values exist. Values are in
> .env.local; never ask for a key in chat. Verify each connector row on
> /admin/analytics?tab=channels via the channel_sync_runs table (service role
> key in .env.local) and paste the real numbers.

## Status 2026-09-11, late (fresh session)

- Section 2 verified against prod: 0 `ghl_form` rows left for the two webinar
  forms; Ghl Form leads 893 over 30 days (153 rows).
- Section 1 done in commit `feat(analytics): pull all three Metricool brands`:
  `METRICOOL_BLOG_IDS` loop, typed per-network reach/clicks merged over the
  brand summary, owner-prefixed sources for the person brands (`tt` added to
  `SUFFIX_CHANNEL`), `metricool_posts.brand_id`. Suite 270 files / 2182 tests.
  Findings from the probe: brand-summary already returns every network for
  the person brands (1,569 and 654 posts over 400 days) but never reach or
  clicks; Vendingpreneurs has no Instagram or LinkedIn posts in 400 days; the
  Facebook page is shared by Vendingpreneurs and Mike (430 of 430 ids match),
  so the first brand listed owns a post; Instagram typed ids differ from the
  summary ids and join on the post URL; `stories/instagram` 500s and is
  skipped. `METRICOOL_BLOG_IDS` is in `.env.local` and Vercel Production.
- Owed before the three-brand pull works in prod: apply
  `supabase/migrations/20260911200000_metricool_posts_brand_id.sql` (the
  session had no DB password and the keychain read for the Supabase access
  token was denied), then `GET /api/admin/metricool-sync/run?days=400`.
- Fix-these-links host filter: not decided, left as is.
- Section 3 and 4: `BITLY_*` empty, `GOOGLE_OAUTH_*` absent in `.env.local`.
  Bitly needs a Generic Access Token (Settings → API), not an OAuth app.
- Section 6: artifact republished (version 3). Google Doc not edited: the
  Drive connector cannot change body text. FigJam unchanged.
