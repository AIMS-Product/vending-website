-- SEO Page Builder Slice 7 — resource-page lead attribution.
--
-- Builder lead forms must identify the page, keyword, block, CTA tracking
-- name, UTMs, and referrer before they can be public.

alter table public.lead_submissions
  add column source_page_id uuid references public.seo_pages(id) on delete set null,
  add column source_page_slug text,
  add column target_keyword text,
  add column source_block_id text,
  add column source_cta_tracking_name text;

create index lead_submissions_source_page_idx
  on public.lead_submissions (source_page_id, created_at desc);

create index lead_submissions_source_block_idx
  on public.lead_submissions (source_block_id);

create index lead_submissions_source_cta_idx
  on public.lead_submissions (source_cta_tracking_name);
