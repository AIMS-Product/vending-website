-- SEO Day 0: frozen baseline numbers the /admin/seo scorecard compares to.
-- One row per (day, metric). Written once by scripts/seo-day0.mjs, which
-- never overwrites an existing row, so the baseline stays frozen.
-- Service-role only (RLS on, no policies), like every other seo_* table.

create table if not exists public.seo_baselines (
  day        date    not null,
  metric     text    not null,
  value      numeric,
  detail     jsonb   not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (day, metric)
);

alter table public.seo_baselines enable row level security;

comment on table public.seo_baselines is
  'SEO Day 0 baseline: one frozen value per metric per baseline day. Written by scripts/seo-day0.mjs (insert only). Service-role only.';
