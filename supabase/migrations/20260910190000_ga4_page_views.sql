-- GA4 daily page-view aggregates.
--
-- The funnel's visits stage had no history: `lead_page_views` is fed by a live
-- client event and was created on 2026-09-10, so it starts at zero. GA4 has
-- been recording the same visits since 2026-02-26 and its
-- `sessionCampaignName` values are our `utm_campaign` slugs verbatim, so this
-- backfills four months that were otherwise unrecoverable.
--
-- Stores every channel, not only YouTube: the whole history is ~16k rows, and
-- keeping it all means the other analytics tabs can read it later without a
-- second backfill. Channel classification stays in `resolveChannel`, which is
-- the single place that rule is allowed to live.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- `youtube_videos`, `bitly_link_clicks` and `lead_page_views`.
create table if not exists public.ga4_page_views (
  -- The GA4 `date` dimension. NOTE: this is a day in the property's timezone,
  -- America/Los_Angeles, not UTC. The rollup's day keys are UTC; for a daily
  -- visit count that is a boundary rounding difference, but anything joining
  -- visits to leads day-by-day has to reconcile the two deliberately.
  day                      date not null,
  landing_page             text not null,
  -- GA4 writes the literal strings "(not set)" and "(direct)" rather than
  -- null. Stored as they arrive so a row is never silently attributed to a
  -- campaign it did not carry.
  utm_campaign             text not null,
  utm_source               text not null,
  -- Only additive metrics. bounceRate is deliberately absent: it is a ratio
  -- and summing it across rows is meaningless. engaged_sessions / sessions
  -- derives it correctly at read time.
  screen_page_views        integer not null default 0 check (screen_page_views >= 0),
  sessions                 integer not null default 0 check (sessions >= 0),
  engaged_sessions         integer not null default 0 check (engaged_sessions >= 0),
  new_users                integer not null default 0 check (new_users >= 0),
  key_events               integer not null default 0 check (key_events >= 0),
  -- Seconds, summed across sessions. GA4 returns this as a float string.
  user_engagement_seconds  numeric not null default 0 check (user_engagement_seconds >= 0),
  synced_at                timestamptz not null default now(),
  primary key (day, landing_page, utm_campaign, utm_source)
);

-- The rollup filters by campaign over a date range.
create index if not exists ga4_page_views_campaign_day_idx
  on public.ga4_page_views (utm_campaign, day desc);

-- The sync claims and replaces whole days.
create index if not exists ga4_page_views_day_idx
  on public.ga4_page_views (day desc);

alter table public.ga4_page_views enable row level security;

comment on table public.ga4_page_views is
  'Daily GA4 aggregates from properties/526227693:runReport, keyed on (day, landing page, campaign, source) so a re-sync corrects a day rather than double-counting it. day is a Pacific day, not UTC. Excludes exits and watch time: exits is Explorations-only and watch time is not GA4 data at all.';
