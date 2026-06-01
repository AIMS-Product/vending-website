-- Archived SEO pages are retained for audit/revision history, but they should
-- not permanently reserve a demo slug after cleanup.

alter table public.seo_pages
  drop constraint if exists seo_pages_slug_key;

create unique index if not exists seo_pages_active_slug_unique_idx
  on public.seo_pages (slug)
  where status <> 'archived';

comment on index public.seo_pages_active_slug_unique_idx is
  'SEO page slugs must be unique for active draft/published pages; archived pages do not reserve reusable demo slugs.';
