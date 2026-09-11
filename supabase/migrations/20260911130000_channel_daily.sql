-- The channel spine.
--
-- One fact table every connector writes and the Channels dashboard reads.
-- Grain: one row per day per (channel, source, medium, campaign, content,
-- destination). The six dimension columns are the five UTMs of the link
-- standard (docs/marketing/link-standard.md) plus the channel that
-- resolveChannel() assigns to the source, so the dashboard never re-classifies.
--
-- Metrics are additive counts and money only; every rate is derived at read
-- time. Every metric is NULLABLE and NULL MEANS NOT OBSERVED: a connector that
-- has no way to see a stage leaves the column alone, and the UI says "not
-- observed" instead of printing a zero. Each connector upserts only its own
-- metric columns, so GA4 writing visits does not blank the leads column the
-- lead connector wrote for the same key.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- ga4_page_views. Aggregates only; there is deliberately nowhere here to put a
-- name, an email or a lead id.
create table if not exists public.channel_daily (
  day          date not null,
  channel      text not null,
  source       text not null,
  medium       text not null,
  campaign     text not null,
  content      text not null,
  destination  text not null,
  -- Money in whole currency units (USD), not cents, matching Meta's reporting.
  spend        numeric check (spend is null or spend >= 0),
  impressions  integer check (impressions is null or impressions >= 0),
  reach        integer check (reach is null or reach >= 0),
  clicks       integer check (clicks is null or clicks >= 0),
  visits       integer check (visits is null or visits >= 0),
  leads        integer check (leads is null or leads >= 0),
  booked       integer check (booked is null or booked >= 0),
  showed       integer check (showed is null or showed >= 0),
  won          integer check (won is null or won >= 0),
  revenue      numeric check (revenue is null or revenue >= 0),
  synced_at    timestamptz not null default now(),
  primary key (day, channel, source, medium, campaign, content, destination)
);

-- The dashboard reads a date range and groups by channel.
create index if not exists channel_daily_day_idx
  on public.channel_daily (day desc);

create index if not exists channel_daily_channel_day_idx
  on public.channel_daily (channel, day desc);

alter table public.channel_daily enable row level security;

comment on table public.channel_daily is
  'Daily channel spine keyed on the link standard (channel, source, medium, campaign, content, destination). Additive metrics only; NULL means not observed, never zero. Each connector upserts only the metric columns it can see.';

-- Sync health. One row per connector run, so every tab can say "last synced
-- X ago" and a connector that fails silently shows red instead of quietly
-- freezing its numbers at last week's values.
create table if not exists public.channel_sync_runs (
  id            bigserial primary key,
  connector     text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  rows_written  integer not null default 0 check (rows_written >= 0),
  -- Short, secret-free error text. Null on success.
  error         text
);

create index if not exists channel_sync_runs_connector_started_idx
  on public.channel_sync_runs (connector, started_at desc);

alter table public.channel_sync_runs enable row level security;

comment on table public.channel_sync_runs is
  'One row per connector run into channel_daily. The dashboard shows the latest row per connector; error set means the run failed.';

-- Short links minted by the builder are read by the Bitly click sync the same
-- way registry links are: least-recently-synced first.
alter table public.marketing_links
  add column if not exists clicks_synced_at timestamptz;

create index if not exists marketing_links_clicks_sync_idx
  on public.marketing_links (clicks_synced_at nulls first)
  where bitly_id is not null;
