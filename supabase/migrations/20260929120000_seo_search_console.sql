-- SEO command center, slice 1: Search Console by day, page and query.
--
-- The channel spine (`channel_daily`) already holds one Search Console row a
-- day (impressions and clicks only). These tables add what /admin/seo needs:
-- average position, the branded / non-branded split, and every page and
-- query. Written by /api/admin/search-console-sync/run (connector
-- `seo-search-console`); every write is an upsert on the primary key, so a
-- re-run or a backfill (`?days=500`) is safe.
--
-- The property (sc-domain:vendingpreneurs.com) has data from 2025-11-26 only.
-- Volume is small (about 50 query-page rows a day), so no rollup tables.
-- Service-role only: RLS on, no policies.

create table if not exists public.seo_gsc_daily (
  day               date primary key,
  clicks            integer not null default 0,
  impressions       integer not null default 0,
  -- Impression-weighted average position for the whole site, 1 = top.
  position          numeric(8, 2),
  -- Sums of the query rows whose query matches a brand term. Anonymized
  -- queries never appear by query, so non-branded = total - branded.
  brand_clicks      integer not null default 0,
  brand_impressions integer not null default 0,
  synced_at         timestamptz not null default now()
);

create table if not exists public.seo_gsc_page_daily (
  day         date not null,
  page        text not null,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    numeric(8, 2),
  synced_at   timestamptz not null default now(),
  primary key (day, page),
  constraint seo_gsc_page_daily_page_len check (length(page) <= 2000)
);

create index if not exists seo_gsc_page_daily_page_idx
  on public.seo_gsc_page_daily (page, day);

create table if not exists public.seo_gsc_query_daily (
  day         date not null,
  query       text not null,
  page        text not null,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    numeric(8, 2),
  synced_at   timestamptz not null default now(),
  primary key (day, query, page),
  constraint seo_gsc_query_daily_query_len check (length(query) <= 1000),
  constraint seo_gsc_query_daily_page_len check (length(page) <= 2000)
);

create index if not exists seo_gsc_query_daily_query_idx
  on public.seo_gsc_query_daily (query, day);

-- Per query per day, all pages together (the date + query report). Use this
-- for query totals: the query + page table counts one search once per VP
-- page it showed, so summing it double counts.
create table if not exists public.seo_gsc_query_totals_daily (
  day         date not null,
  query       text not null,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    numeric(8, 2),
  synced_at   timestamptz not null default now(),
  primary key (day, query),
  constraint seo_gsc_query_totals_daily_query_len check (length(query) <= 1000)
);

alter table public.seo_gsc_daily enable row level security;
alter table public.seo_gsc_query_totals_daily enable row level security;
alter table public.seo_gsc_page_daily enable row level security;
alter table public.seo_gsc_query_daily enable row level security;

comment on table public.seo_gsc_daily is
  'Search Console web totals per Pacific day with average position and the branded split. Written by the search-console sync (connector seo-search-console). Service-role only.';
comment on table public.seo_gsc_page_daily is
  'Search Console web clicks, impressions and position per page per day. Service-role only.';
comment on table public.seo_gsc_query_daily is
  'Search Console web clicks, impressions and position per query and page per day. Anonymized queries are absent by Google''s design. Service-role only.';
