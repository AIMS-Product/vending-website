drop policy if exists seo_pages_public_read on public.seo_pages;

revoke all on table public.seo_pages from anon;
revoke all on table public.seo_pages from authenticated;

create policy seo_pages_public_read
  on public.seo_pages
  for select
  to anon
  using (status = 'published' and published_content is not null);

grant select (
  id,
  slug,
  title,
  target_keyword,
  published_content,
  seo_title,
  meta_description,
  canonical_url,
  noindex,
  sitemap_enabled,
  structured_data_settings,
  published_at,
  updated_at,
  status
) on table public.seo_pages to anon;

grant select, insert, update, delete on table public.seo_pages to authenticated;

create or replace view public.published_seo_pages
with (security_invoker = true) as
select
  id,
  slug,
  title,
  target_keyword,
  published_content,
  seo_title,
  meta_description,
  canonical_url,
  noindex,
  sitemap_enabled,
  structured_data_settings,
  published_at,
  updated_at
from public.seo_pages
where status = 'published'
  and published_content is not null;

revoke all on table public.published_seo_pages from public;
grant select on table public.published_seo_pages to anon, authenticated;
