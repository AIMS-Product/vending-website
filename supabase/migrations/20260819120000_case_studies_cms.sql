-- Case Studies CMS
--
-- A video-first customer testimonial collection. Each row is one member story:
-- a YouTube interview, a pull quote, a short written story, and structured
-- result figures.
--
-- Modelled on news_posts (20260501042413_init_news_cms.sql) so the two
-- collections share the admin gate, the RLS shape and the set_updated_at
-- trigger. The differences are the video hero, the pull quote, and the
-- structured result columns that make the index page filterable.
--
-- Security model is identical to news_posts:
--   * RLS is the boundary. anon SELECTs only status='published' rows.
--   * authenticated may mutate only when auth.uid() resolves to app_users.
--   * service-role bypasses RLS, used from server-only admin code paths.

-- ---------------------------------------------------------------------------
-- 1. case_studies
-- ---------------------------------------------------------------------------

create table public.case_studies (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title               text not null,            -- headline, carries the result
  member_name         text not null,
  member_role         text,                     -- short factual descriptor
  excerpt             text,                     -- meta description + card copy
  youtube_video_id    text,                     -- bare id, never a full URL
  quote               text,                     -- featured pull quote
  quote_attribution   text,
  body                text not null default '', -- markdown story
  cover_url           text,                     -- optional; falls back to the
  cover_alt           text,                     -- youtube thumbnail
  stats               jsonb not null default '[]'::jsonb,  -- [{label,value}]

  -- Structured result fields. Denormalised out of `stats` on purpose: these
  -- are what the index page filters and sorts on, and jsonb predicates would
  -- not use an index here.
  monthly_revenue_usd integer,
  machine_count       integer,
  location_count      integer,
  months_to_result    integer,
  prior_occupation    text,
  location_types      text[] not null default '{}',
  tags                text[] not null default '{}',

  -- Curated "More Success Stories" links. Slugs rather than FKs so an editor
  -- can order them freely and a referenced story going to draft degrades to a
  -- skipped card instead of a broken page.
  related_slugs       text[] not null default '{}',

  status              text not null default 'draft'
                      check (status in ('draft', 'published', 'archived')),
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint case_studies_youtube_video_id_shape
    check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{6,}$'),
  constraint case_studies_stats_is_array
    check (jsonb_typeof(stats) = 'array'),
  constraint case_studies_published_needs_video
    check (status <> 'published' or youtube_video_id is not null)
);

create index case_studies_published_idx
  on public.case_studies (status, published_at desc);

create index case_studies_slug_idx
  on public.case_studies (slug);

-- Index-page filters.
create index case_studies_revenue_idx
  on public.case_studies (monthly_revenue_usd desc nulls last)
  where status = 'published';

create index case_studies_tags_idx
  on public.case_studies using gin (tags);

create index case_studies_location_types_idx
  on public.case_studies using gin (location_types);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger (function already defined by the news CMS migration)
-- ---------------------------------------------------------------------------

create trigger case_studies_set_updated_at
  before update on public.case_studies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

alter table public.case_studies enable row level security;

create policy case_studies_public_read
  on public.case_studies
  for select
  to anon, authenticated
  using (status = 'published');

create policy case_studies_admin_all
  on public.case_studies
  for all
  to authenticated
  using (
    exists (select 1 from public.app_users u where u.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.app_users u where u.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Cover image storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-study-images',
  'case-study-images',
  true,
  5242880,
  array['image/avif', 'image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy case_study_images_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'case-study-images');

create policy case_study_images_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'case-study-images'
    and exists (select 1 from public.app_users u where u.user_id = auth.uid())
  );

create policy case_study_images_admin_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'case-study-images'
    and exists (select 1 from public.app_users u where u.user_id = auth.uid())
  )
  with check (
    bucket_id = 'case-study-images'
    and exists (select 1 from public.app_users u where u.user_id = auth.uid())
  );

create policy case_study_images_admin_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'case-study-images'
    and exists (select 1 from public.app_users u where u.user_id = auth.uid())
  );
