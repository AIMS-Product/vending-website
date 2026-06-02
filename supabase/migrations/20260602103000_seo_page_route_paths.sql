-- Route-prefix aware SEO page paths.
-- Existing SEO/resource pages keep their current /resources/{slug} paths.

alter table public.seo_pages
  add column if not exists route_prefix text not null default '/resources',
  add column if not exists route_path text;

update public.seo_pages
  set
    route_prefix = coalesce(nullif(route_prefix, ''), '/resources'),
    route_path = coalesce(nullif(route_path, ''), '/resources/' || slug)
  where route_path is null
     or route_path = ''
     or route_prefix is null
     or route_prefix = '';

alter table public.seo_pages
  alter column route_path set not null;

alter table public.seo_pages
  drop constraint if exists seo_pages_route_prefix_check,
  add constraint seo_pages_route_prefix_check
    check (route_prefix in ('/resources', '/blog', '/landing', '/videos', '/solutions'));

alter table public.seo_pages
  drop constraint if exists seo_pages_route_path_check,
  add constraint seo_pages_route_path_check
    check (route_path ~ '^/(resources|blog|landing|videos|solutions)/[a-z0-9]+(-[a-z0-9]+)*');

drop index if exists public.seo_pages_active_slug_unique_idx;

create unique index if not exists seo_pages_active_route_path_unique_idx
  on public.seo_pages (route_path)
  where status <> 'archived';

comment on index public.seo_pages_active_route_path_unique_idx is
  'Ensures active builder pages are unique by full public path while allowing archived history.';

alter table public.redirects
  drop constraint if exists redirects_source_path_check,
  add constraint redirects_source_path_check
    check (source_path ~ '^/(resources|blog|landing|videos|solutions)/[^?#]+');

create or replace view public.published_seo_pages
with (security_invoker = true) as
select
  p.id,
  coalesce(r.seo_snapshot ->> 'slug', p.slug) as slug,
  coalesce(r.seo_snapshot ->> 'title', p.title) as title,
  coalesce(r.seo_snapshot ->> 'target_keyword', p.target_keyword) as target_keyword,
  r.content_snapshot as published_content,
  coalesce(r.seo_snapshot ->> 'seo_title', p.seo_title) as seo_title,
  coalesce(r.seo_snapshot ->> 'meta_description', p.meta_description) as meta_description,
  coalesce(r.seo_snapshot ->> 'canonical_url', p.canonical_url) as canonical_url,
  case
    when r.seo_snapshot ? 'noindex' then (r.seo_snapshot ->> 'noindex')::boolean
    else p.noindex
  end as noindex,
  case
    when r.seo_snapshot ? 'sitemap_enabled' then (r.seo_snapshot ->> 'sitemap_enabled')::boolean
    else p.sitemap_enabled
  end as sitemap_enabled,
  coalesce(
    r.seo_snapshot -> 'structured_data_settings',
    p.structured_data_settings
  ) as structured_data_settings,
  p.published_at,
  r.created_at as updated_at,
  coalesce(r.seo_snapshot ->> 'route_prefix', p.route_prefix, '/resources') as route_prefix,
  coalesce(
    r.seo_snapshot ->> 'route_path',
    p.route_path,
    '/resources/' || coalesce(r.seo_snapshot ->> 'slug', p.slug)
  ) as route_path,
  p.page_type
from public.seo_pages p
join public.page_revisions r
  on r.id = p.published_revision_id
where p.status = 'published'
  and p.published_revision_id is not null;

revoke all on table public.published_seo_pages from public;
grant select on table public.published_seo_pages to anon, authenticated;
grant select (route_prefix, route_path, page_type) on table public.seo_pages
  to anon, authenticated;
