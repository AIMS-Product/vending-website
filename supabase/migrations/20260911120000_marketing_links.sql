-- Marketing link registry.
--
-- Every link built at /admin/links is stored here, so the Channels dashboard
-- can list "what is going out" from the registry rather than only from what
-- got clicked: a link with zero clicks is still a link we published. The five
-- UTMs are stored as separate columns, validated against the closed lists in
-- src/lib/analytics/link-standard.ts (docs/marketing/link-standard.md).
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- ga4_page_views. The builder runs as an admin Server Action behind
-- requireAdmin(); created_by records which admin built the link.
create table if not exists public.marketing_links (
  id            uuid primary key default gen_random_uuid(),
  -- The finished URL, UTMs included. What gets pasted into the post.
  url           text not null,
  base_url      text not null,
  utm_source    text not null,
  utm_medium    text not null,
  utm_campaign  text not null,
  utm_content   text not null,
  -- utm_term is the destination under the standard. Stored under the UTM name
  -- so a join against any *_utm_term column is the same string.
  utm_term      text not null,
  -- Optional human label ("IG bio link, Sept webinar").
  label         text,
  -- Bitly's `{bitlink}` id (host + back-half) and the https short URL, when
  -- the builder minted one. Joins to bitly_link_clicks.bitly_id.
  bitly_id      text,
  bitly_url     text,
  created_by    text not null,
  created_at    timestamptz not null default now()
);

create index if not exists marketing_links_created_idx
  on public.marketing_links (created_at desc);

create index if not exists marketing_links_campaign_idx
  on public.marketing_links (utm_campaign, utm_content);

create unique index if not exists marketing_links_bitly_id_idx
  on public.marketing_links (bitly_id)
  where bitly_id is not null;

alter table public.marketing_links enable row level security;

comment on table public.marketing_links is
  'Registry of every outbound marketing link built at /admin/links. utm_term is the destination (book-call, lead-magnet, webinar-register, apply, content, none). Service-role only.';
