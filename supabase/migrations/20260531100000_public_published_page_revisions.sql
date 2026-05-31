-- Public resource pages should render the immutable revision that was
-- selected at publish time, not mutable draft/live columns on seo_pages.

drop policy if exists page_revisions_public_current_published_read
  on public.page_revisions;

create policy page_revisions_public_current_published_read
  on public.page_revisions
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.seo_pages p
      where p.published_revision_id = page_revisions.id
        and p.status = 'published'
    )
  );

grant select (
  id,
  page_id,
  revision_type,
  label,
  content_snapshot,
  seo_snapshot,
  created_at
) on table public.page_revisions to anon, authenticated;

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
  r.created_at as updated_at
from public.seo_pages p
join public.page_revisions r
  on r.id = p.published_revision_id
where p.status = 'published'
  and p.published_revision_id is not null;

revoke all on table public.published_seo_pages from public;
grant select on table public.published_seo_pages to anon, authenticated;
