-- Metricool posts, one row per published post across every connected network.
--
-- Metricool's brand summary (GET /v2/analytics/brand-summary/posts) returns
-- every post in a date range with its network, text, permalink, publication
-- time and a metrics map. The connector stores the post, the first outbound
-- URL found in its text, the UTMs parsed off that URL and whether the URL
-- passes the link standard. That last column feeds the "Fix these links"
-- panel: it is how the standard gets enforced on the team.
--
-- Metrics are per post, lifetime, as of synced_at. The connector re-reads a
-- trailing window so they keep catching up. NULL means Metricool did not
-- report that metric for that network, never zero.
--
-- Security model: service-role only (RLS enabled, no policies).
create table if not exists public.metricool_posts (
  post_id        text primary key,
  network        text not null,
  published_at   timestamptz not null,
  -- The post on the network.
  permalink      text,
  -- First http(s) URL found in the post text, or null: an Instagram caption
  -- link is not clickable and a post with no URL is not a link to check.
  link           text,
  text_excerpt   text,
  reach          integer check (reach is null or reach >= 0),
  impressions    integer check (impressions is null or impressions >= 0),
  clicks         integer check (clicks is null or clicks >= 0),
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  -- Null when there is no link to check.
  link_compliant boolean,
  link_problems  text[] not null default '{}',
  -- Metricool's raw metrics map, kept so a renamed metric can be re-read
  -- without another pull.
  metrics        jsonb not null default '{}'::jsonb,
  synced_at      timestamptz not null default now()
);

create index if not exists metricool_posts_published_idx
  on public.metricool_posts (published_at desc);

create index if not exists metricool_posts_noncompliant_idx
  on public.metricool_posts (published_at desc)
  where link_compliant = false;

alter table public.metricool_posts enable row level security;

comment on table public.metricool_posts is
  'Published social posts from Metricool with the outbound link, its UTMs and a link-standard check. Service-role only.';
