-- The public published_seo_pages view runs with security_invoker=true and
-- joins seo_pages to page_revisions through published_revision_id. Anonymous
-- public reads therefore need column-level access to that join key.

grant select (published_revision_id) on table public.seo_pages to anon, authenticated;
