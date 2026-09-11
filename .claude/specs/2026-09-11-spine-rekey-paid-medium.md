# Spine re-key, paid medium, like-for-like Calendly check

2026-09-11, late. Picked up from the session that ran out of usage while
chasing "phantom leads by source" on the Channels tab.

## Root causes found in prod

- `channel_daily`'s primary key included `channel`, which is derived from
  `source`. Every channel rename (google -> Organic search, referrer hosts ->
  Referral / Website, ltf -> Low ticket funnel, ghl -> Instagram DM) made the
  next sync write a new row under the new label and leave the old one. The
  read-time normaliser then relabelled both to the same channel and summed
  them. Measured: 2,788 doubled keys; over 30 days 140 leads, 85 booked,
  52 showed, 7,651 visits and 4 won counted twice.
- `resolveChannel` ignored `utm_medium`, so `google` / `cpc` with numeric
  Google Ads campaign ids (273 leads, 147 booked over 30 days, before
  de-duplication) sat under Organic search. `meta` / `paid` sat under Meta.
- The "Bookings match Calendly" confidence check compared spine bookings
  (lead-linked or tagged) with every booked Calendly event, including
  untagged next-steps, onboarding and rescheduled calls the connector never
  counts, so it could never pass.

## Slice (one commit)

1. Migration `20260912000000_channel_daily_key_without_channel.sql`: merge
   duplicate keys (newest synced value per metric, Webinar label wins), drop
   `channel` from the primary key, trigger keeps a Webinar label once set.
2. `channel-daily.ts`: conflict target without `channel`; `channelDailyKey`
   passes medium to `resolveChannel` (not for explicit program channels).
3. `channel.ts`: `PAID_MEDIUM` (`cpc`, `ppc`, `paid`, `paid-search`,
   `social-paid`, `display`, `pmax`) moves `google` to Google Ads and
   `meta` / `facebook` / `instagram` to Meta Ads. `normaliseFacts` and the
   leads rollup pass medium.
4. `channel-report.ts`: Calendly comparator restricted to linked-or-tagged
   bookings; check label says so.

Assumptions to flag: any `google` + paid medium is Google Ads (the campaign
ids are Google Ads ids); `instagram` + paid medium is Meta Ads.

## Deploy order (matters)

1. Apply the migration in the Supabase SQL editor. The upsert's new conflict
   target errors until the unique constraint exists.
2. Push `main`. Vercel deploys.
3. `GET /api/admin/channel-sync/run?days=400` with `CRON_SECRET` so old days
   are rewritten under their current channel labels.
4. Confirm on `/admin/analytics?tab=channels`: Google and Organic search no
   longer twin, Google Ads appears with leads and booked, the Calendly check
   is ok or warn, not fail.

## Still owed (unchanged)

Bitly generic access token; `GOOGLE_OAUTH_*` for YouTube Analytics; Mike's
ManyChat External Request actions.
