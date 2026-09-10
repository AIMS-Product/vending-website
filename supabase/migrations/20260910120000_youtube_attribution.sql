-- YouTube per-video attribution.
--
-- Adds the three things the funnel needs and does not have: the video registry
-- (so a campaign slug can be reported as a video title), Bitly click counts,
-- and landing-page visits. Also dates the end of the funnel on
-- `lead_submissions`, which until now held the Close status label with no
-- timestamp and so could not answer "how long did that take".
--
-- Security model: all three new tables are service-role only (RLS enabled, no
-- policies), matching `public_request_hits`. Every reader is a server rollup
-- using the admin client, and none of this is public data.

-- The registry of tracked videos, keyed on the value leads actually carry.
--
-- utm_campaign is the primary key rather than the video URL because that is the
-- join the lead rows can satisfy: a lead knows its campaign slug and has never
-- seen a video ID. Verified against production — 42 of the 43 slugs that have
-- produced leads match the registry exactly.
create table if not exists public.youtube_videos (
  utm_campaign      text primary key,
  title             text not null,
  video_url         text not null,
  video_id          text,
  published_at      date,
  bitly_url         text,
  -- The Bitly API's `{bitlink}` path segment: host + back-half with no scheme,
  -- e.g. "booking.vendingpreneurs.com/yt-desc-link-1-how-much-vending".
  bitly_id          text,
  destination_path  text,
  redirect_verified boolean not null default false,
  in_description    boolean not null default false,
  -- Set by the Bitly sync so it can claim least-recently-synced rows instead of
  -- re-reading all 604 links every run.
  clicks_synced_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists youtube_videos_published_idx
  on public.youtube_videos (published_at desc nulls last);

-- The sync's batch claim: never-synced rows first, then the stalest.
create index if not exists youtube_videos_clicks_sync_idx
  on public.youtube_videos (clicks_synced_at nulls first)
  where bitly_id is not null;

drop trigger if exists youtube_videos_set_updated_at on public.youtube_videos;
create trigger youtube_videos_set_updated_at
  before update on public.youtube_videos
  for each row execute function public.set_updated_at();

alter table public.youtube_videos enable row level security;

comment on table public.youtube_videos is
  'Mirror of the Master Registry spreadsheet, keyed on utm_campaign so lead rows join to a video title. Imported by scripts/import-youtube-registry.mjs, then maintained by the Bitly sync.';

-- Daily click counts per short link.
--
-- Daily grain, not a running total: the analytics page already filters by
-- 7d/30d/90d/1y, and a lifetime total cannot answer "clicks in this range".
create table if not exists public.bitly_link_clicks (
  bitly_id     text not null,
  day          date not null,
  clicks       integer not null default 0 check (clicks >= 0),
  -- Denormalised from youtube_videos so the rollup reads one table. The Bitly
  -- API returns the long URL with the UTMs on it, so this is derived from the
  -- link itself rather than guessed.
  utm_campaign text,
  synced_at    timestamptz not null default now(),
  primary key (bitly_id, day)
);

create index if not exists bitly_link_clicks_campaign_day_idx
  on public.bitly_link_clicks (utm_campaign, day desc)
  where utm_campaign is not null;

alter table public.bitly_link_clicks enable row level security;

comment on table public.bitly_link_clicks is
  'Per-day click counts from GET /v4/bitlinks/{bitlink}/clicks. Upserted on (bitly_id, day) so a re-sync corrects a day rather than double-counting it.';

-- Tagged landing-page visits, the stage between a click and a form fill.
--
-- Fed by the `landing_viewed` attribution event, which already fires on every
-- page and already carries the UTMs — no client change was needed. Only tagged
-- traffic is stored: an untagged pageview cannot be attributed to a video and
-- would turn this into a general analytics table nobody asked for.
create table if not exists public.lead_page_views (
  id            bigserial primary key,
  path          text not null,
  utm_source    text,
  utm_campaign  text,
  utm_content   text,
  vp_session_id text not null,
  -- Day of `occurred_at`, stored so the dedupe below can be a unique index.
  occurred_on   date not null,
  occurred_at   timestamptz not null default now()
);

-- One visit per session, per path, per day. A visitor who reloads
-- /booking-youtube four times is one visit, not four — otherwise the top of the
-- funnel inflates and every conversion rate below it reads low.
create unique index if not exists lead_page_views_session_day_idx
  on public.lead_page_views (vp_session_id, path, occurred_on);

create index if not exists lead_page_views_campaign_idx
  on public.lead_page_views (utm_campaign, occurred_at desc)
  where utm_campaign is not null;

alter table public.lead_page_views enable row level security;

comment on table public.lead_page_views is
  'Deduped tagged landing-page visits (one row per session/path/day) from the landing_viewed attribution event. Not general web analytics — rows exist only when a UTM campaign was present.';

-- Date the end of the funnel.
--
-- `call_status` already holds the live Close label, including "Closed / Won",
-- but a label has no date: it answers "is this won" and cannot answer "how long
-- did it take" or "which month should this be credited to".
alter table public.lead_submissions
  add column if not exists closed_won_at date,
  add column if not exists closed_won_source text
    check (
      closed_won_source is null
      or closed_won_source in ('close_opportunity', 'status_observed')
    ),
  add column if not exists call_outcome text
    check (
      call_outcome is null
      or call_outcome in (
        'no_show',
        'canceled',
        'rescheduled',
        'contract_sent',
        'won'
      )
    ),
  add column if not exists close_status_at timestamptz;

comment on column public.lead_submissions.closed_won_at is
  'Date the deal was won. Prefer the Close opportunity date_won; falls back to the day the reconciler first observed a won status label.';
comment on column public.lead_submissions.closed_won_source is
  'Provenance of closed_won_at. Only close_opportunity rows are trustworthy enough to feed time-to-close — status_observed means we saw the label flip and stamped that day, which for a lead already marked won before this migration would invent a duration.';
comment on column public.lead_submissions.call_outcome is
  'What the Close status label actually asserts about the call. Null when the label says nothing about it (e.g. "Follow Up"). Never inferred — "attended" is derived at report time as booked minus no_show minus canceled.';
comment on column public.lead_submissions.close_status_at is
  'When the reconciler first observed the current call_status, giving status changes a date going forward.';

create index if not exists lead_submissions_closed_won_idx
  on public.lead_submissions (closed_won_at)
  where closed_won_at is not null;
