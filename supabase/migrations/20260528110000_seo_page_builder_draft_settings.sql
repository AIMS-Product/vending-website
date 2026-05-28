alter table public.seo_pages
  add column if not exists draft_settings jsonb not null default '{}'::jsonb;

alter table public.seo_pages
  add constraint seo_pages_draft_settings_object
  check (jsonb_typeof(draft_settings) = 'object');
