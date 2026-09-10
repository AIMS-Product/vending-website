-- Length caps on the UTMs stored by the public attribution endpoint.
--
-- `recordTaggedPageView` caps all three at 200 characters, but the write path
-- behind it is POST /api/attribution/events, which is public, unauthenticated,
-- and whose zod schema puts no length bound on a property value. The
-- application cap is the fix; this is the constraint that stops a future
-- caller writing round it.
--
-- 200 is well above every real value: the longest campaign slug in the
-- registry is under 60 characters and every live utm_content is "desc-link-1"
-- or a variant of it.
--
-- Apply together with 20260910120000_youtube_attribution.sql.

alter table public.lead_page_views
  drop constraint if exists lead_page_views_utm_source_len,
  drop constraint if exists lead_page_views_utm_campaign_len,
  drop constraint if exists lead_page_views_utm_content_len;

alter table public.lead_page_views
  add constraint lead_page_views_utm_source_len
    check (utm_source is null or length(utm_source) <= 200),
  add constraint lead_page_views_utm_campaign_len
    check (utm_campaign is null or length(utm_campaign) <= 200),
  add constraint lead_page_views_utm_content_len
    check (utm_content is null or length(utm_content) <= 200);
