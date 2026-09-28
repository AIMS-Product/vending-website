-- SEO command center, slice 3: tracked keywords and weekly SERP snapshots.
--
-- `seo_keywords` is the 223-keyword tracking list (seeded in
-- 20260929124000_seo_seed.sql). `seo_rank_snapshots` is one DataForSEO live
-- SERP pull per keyword per run day: VP's position, the top 10, SERP
-- features and whether an AI Overview cites the VP site or VP YouTube.
-- DataForSEO cannot report past positions, so this history starts at the
-- first pull; the Search Console position series covers the time before.
-- `seo_keyword_volume_monthly` holds the 12 months of Google Ads volume each
-- search_volume call returns. Service-role only.

create table if not exists public.seo_keywords (
  keyword     text primary key,
  piece_ids   text[] not null default '{}',
  hub         text,
  role        text not null default 'supporting'
    check (role in ('primary', 'supporting')),
  volume      integer,
  kd          integer,
  cpc         numeric(10, 2),
  competition numeric(6, 4),
  tracked     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint seo_keywords_len check (length(keyword) <= 300),
  constraint seo_keywords_lower check (keyword = lower(keyword))
);

create table if not exists public.seo_rank_snapshots (
  day               date not null,
  keyword           text not null,
  vp_position       integer,
  vp_url            text,
  ai_overview       boolean not null default false,
  aio_cites_site    boolean not null default false,
  aio_cites_youtube boolean not null default false,
  aio_refs          text[] not null default '{}',
  serp_features     text[] not null default '{}',
  top10             jsonb not null default '[]'::jsonb,
  synced_at         timestamptz not null default now(),
  primary key (day, keyword)
);

create index if not exists seo_rank_snapshots_keyword_idx
  on public.seo_rank_snapshots (keyword, day desc);

create table if not exists public.seo_keyword_volume_monthly (
  month   date not null,
  keyword text not null,
  volume  integer not null,
  primary key (month, keyword)
);

alter table public.seo_keywords enable row level security;
alter table public.seo_rank_snapshots enable row level security;
alter table public.seo_keyword_volume_monthly enable row level security;
