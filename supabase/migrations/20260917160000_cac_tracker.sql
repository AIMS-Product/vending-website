-- CAC tracker: the MTD_CAC_Tracker workbook, in the database.
--
-- The workbook prorates each route owner's fixed monthly cost by the share of the
-- month elapsed, adds that route's variable spend, and divides by closed-won deals.
-- Three things made it drift: Days Elapsed was retyped by hand every week, ad spend
-- was pasted in from elsewhere, and on four September rows somebody typed over the
-- Total MTD Cost formula so the total no longer equalled prorated fixed + variable.
--
-- Grain: one row per (month, route). Month-level inputs live in cac_months so the
-- proration factor is derived from a date rather than retyped.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- channel_daily. Reads and writes go through the admin surface, which authorises
-- with requireReadAccess / requireAdmin before touching the service-role client.
-- No lead, contact or person-level data belongs here; these are route aggregates
-- and staff cost inputs.

create table if not exists public.cac_months (
  month         date primary key,
  days_in_month integer not null check (days_in_month between 28 and 31),
  -- Manual in the workbook, and the first thing that goes stale. Null means "use
  -- today", which is what a live dashboard should do; a number pins it for a
  -- closed month so a historical tab keeps reporting what it reported.
  days_elapsed  integer check (days_elapsed is null or days_elapsed between 0 and 31),
  note          text,
  updated_at    timestamptz not null default now()
);

create table if not exists public.cac_routes (
  id                  uuid primary key default gen_random_uuid(),
  month               date not null references public.cac_months (month) on delete cascade,
  -- EXTERNAL ROUTES / IN-HOUSE ROUTES / OTHER, as the workbook groups them.
  group_label         text not null,
  route               text not null,
  owner               text,
  sort_order          integer not null default 0,
  -- Owner salary or contracting, before proration. Null means the route has no
  -- cost model yet (the workbook prints "— No Model"), which is not zero.
  fixed_monthly_cost  numeric check (fixed_monthly_cost is null or fixed_monthly_cost >= 0),
  -- What a human typed. Kept even when spend_source is 'auto', so the two are
  -- always comparable and switching sources never destroys the other number.
  variable_spend      numeric check (variable_spend is null or variable_spend >= 0),
  -- Which channel_daily rows this route's spend can be read from, when one exists.
  -- 'channel|source', e.g. 'Webinar|meta_ads'. Null means we have no live source.
  spend_channel       text,
  -- 'manual' uses variable_spend, 'auto' uses the channel_daily sum. Default
  -- manual so nothing a human entered is silently replaced by a feed.
  spend_source        text not null default 'manual' check (spend_source in ('manual', 'auto')),
  -- Null means nobody has recorded closes yet, which is not the same as zero
  -- closes. The workbook prints "No Closes" for zero and leaves CAC undefined.
  closed_won          integer check (closed_won is null or closed_won >= 0),
  march_cac           numeric check (march_cac is null or march_cac >= 0),
  notes               text,
  updated_at          timestamptz not null default now(),
  unique (month, route)
);

create index if not exists cac_routes_month_idx on public.cac_routes (month, sort_order);

alter table public.cac_months enable row level security;
alter table public.cac_routes enable row level security;

comment on table public.cac_months is
  'Month-level CAC inputs. days_elapsed null means derive from today, so a live month prorates itself.';
comment on table public.cac_routes is
  'One row per route per month. Total cost = fixed_monthly_cost * (days_elapsed/days_in_month) + the spend named by spend_source.';
comment on column public.cac_routes.spend_source is
  'manual = the typed variable_spend; auto = summed from channel_daily via spend_channel. Never switched without a human asking.';
