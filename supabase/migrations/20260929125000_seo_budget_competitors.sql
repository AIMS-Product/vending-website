-- SEO command center: DataForSEO spend cap and monthly competitor keywords.
--
-- `dataforseo_spend` adds up the `cost` DataForSEO reports on every response,
-- per month and endpoint. The rank job reads the month's total first and
-- skips once DATAFORSEO_MONTHLY_BUDGET_USD (default $25) is reached.
-- `seo_competitor_keywords` is a monthly ranked_keywords pull (top 20) for
-- the tracked competitors and for vendingpreneurs.com itself. Service-role only.

create table if not exists public.dataforseo_spend (
  month    date not null,
  endpoint text not null,
  usd      numeric(10, 4) not null default 0,
  calls    integer not null default 0,
  primary key (month, endpoint)
);

create table if not exists public.seo_competitor_keywords (
  month    date not null,
  domain   text not null,
  keyword  text not null,
  position integer,
  volume   integer,
  url      text,
  primary key (month, domain, keyword)
);

create index if not exists seo_competitor_keywords_month_idx
  on public.seo_competitor_keywords (month desc, position);

alter table public.dataforseo_spend enable row level security;
alter table public.seo_competitor_keywords enable row level security;
