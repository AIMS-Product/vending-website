-- SEO command center, slice 6: daily account-level social numbers and the
-- monthly SEO review.
--
-- `social_account_daily` is Metricool's /v2/analytics/timelines per network
-- per brand per day (connector `metricool-accounts`). A metric a network does
-- not report stays null, never 0. `seo_monthly_reviews` stores the monthly
-- review form (07-task7 section 6) with a snapshot of the numbers it was
-- filled against. Service-role only.

create table if not exists public.social_account_daily (
  day         date not null,
  network     text not null,
  brand_id    text not null,
  followers   integer,
  impressions integer,
  reach       integer,
  interactions integer,
  posts       integer,
  synced_at   timestamptz not null default now(),
  primary key (day, network, brand_id)
);

create table if not exists public.seo_monthly_reviews (
  month       date primary key,
  snapshot    jsonb not null default '{}'::jsonb,
  answers     jsonb not null default '{}'::jsonb,
  reviewed_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.social_account_daily enable row level security;
alter table public.seo_monthly_reviews enable row level security;
