-- SEO Page Builder Slice 1 — schema, snapshots, media, and DB redirects.
--
-- Security model:
--   * Drafts, revisions, and media library writes are admin-only through the
--     existing app_users gate.
--   * Public readers can read only published page snapshots and redirect rows.
--   * Builder redirects are database-backed. next.config.ts remains reserved
--     for legacy Webflow/canonical redirect rules.

-- ---------------------------------------------------------------------------
-- 1. media_assets
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id                    uuid primary key default gen_random_uuid(),
  asset_type            text not null
                        check (asset_type in ('image', 'video', 'embed')),
  title                 text not null,
  alt_text              text,
  caption               text,
  source_rights_notes   text,
  storage_bucket        text,
  storage_path          text,
  external_url          text,
  thumbnail_asset_id    uuid references public.media_assets(id) on delete set null,
  width                 integer check (width is null or width > 0),
  height                integer check (height is null or height > 0),
  duration_seconds      integer check (duration_seconds is null or duration_seconds > 0),
  tags                  text[] not null default '{}'::text[],
  uploaded_by           uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create index media_assets_type_idx
  on public.media_assets (asset_type, created_at desc);

create index media_assets_tags_idx
  on public.media_assets using gin (tags);

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. seo_pages
-- ---------------------------------------------------------------------------

create table public.seo_pages (
  id                         uuid primary key default gen_random_uuid(),
  slug                       text not null unique
                             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                      text not null,
  status                     text not null default 'draft'
                             check (status in ('draft', 'published', 'archived')),
  target_keyword             text,
  page_type                  text not null default 'resource',
  template_key               text not null default 'standard',
  draft_content              jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  published_content          jsonb,
  published_revision_id      uuid,
  seo_title                  text,
  meta_description           text,
  canonical_url              text,
  noindex                    boolean not null default false,
  sitemap_enabled            boolean not null default true,
  og_asset_id                uuid references public.media_assets(id) on delete set null,
  structured_data_settings   jsonb not null default '{}'::jsonb,
  published_at               timestamptz,
  archived_at                timestamptz,
  archive_behavior           text not null default 'not_found'
                             check (archive_behavior in ('not_found', 'redirect')),
  archive_redirect_url       text,
  created_by                 uuid,
  updated_by                 uuid,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (not noindex or sitemap_enabled = false),
  check (
    status <> 'published'
    or (
      published_content is not null
      and published_revision_id is not null
      and published_at is not null
      and seo_title is not null
      and meta_description is not null
    )
  ),
  check (
    archive_behavior <> 'redirect'
    or archive_redirect_url is not null
  )
);

create index seo_pages_status_updated_idx
  on public.seo_pages (status, updated_at desc);

create index seo_pages_published_sitemap_idx
  on public.seo_pages (status, sitemap_enabled, noindex)
  where status = 'published';

create trigger seo_pages_set_updated_at
  before update on public.seo_pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. page_revisions
-- ---------------------------------------------------------------------------

create table public.page_revisions (
  id                 uuid primary key default gen_random_uuid(),
  page_id            uuid not null references public.seo_pages(id),
  revision_type      text not null
                     check (
                       revision_type in (
                         'autosave',
                         'manual_save',
                         'publish',
                         'rollback',
                         'ai_insert'
                       )
                     ),
  label              text,
  content_snapshot   jsonb not null,
  seo_snapshot       jsonb not null default '{}'::jsonb,
  created_by         uuid,
  created_at         timestamptz not null default now()
);

create index page_revisions_page_created_idx
  on public.page_revisions (page_id, created_at desc);

create index page_revisions_type_idx
  on public.page_revisions (revision_type, created_at desc);

alter table public.seo_pages
  add constraint seo_pages_published_revision_fk
  foreign key (published_revision_id)
  references public.page_revisions(id)
  on delete set null;

create or replace function public.prevent_page_revision_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'page_revisions are immutable append-only snapshots';
end;
$$;

create trigger page_revisions_no_update
  before update on public.page_revisions
  for each row execute function public.prevent_page_revision_mutation();

create trigger page_revisions_no_delete
  before delete on public.page_revisions
  for each row execute function public.prevent_page_revision_mutation();

-- ---------------------------------------------------------------------------
-- 4. redirects
-- ---------------------------------------------------------------------------

create table public.redirects (
  id                uuid primary key default gen_random_uuid(),
  source_path       text not null unique
                    check (source_path ~ '^/resources/[^?#]+$'),
  destination_path  text not null
                    check (
                      destination_path ~ '^/[^/].*'
                      or destination_path ~ '^https?://'
                    ),
  status_code       integer not null default 301
                    check (status_code in (301, 302, 307, 308)),
  page_id           uuid references public.seo_pages(id) on delete set null,
  created_reason    text not null default 'manual'
                    check (created_reason in ('slug_changed', 'page_archived', 'manual')),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  check (source_path <> destination_path)
);

create index redirects_page_idx
  on public.redirects (page_id);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.media_assets   enable row level security;
alter table public.seo_pages      enable row level security;
alter table public.page_revisions enable row level security;
alter table public.redirects      enable row level security;

create policy media_assets_admin_all
  on public.media_assets
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy seo_pages_public_read
  on public.seo_pages
  for select
  to anon, authenticated
  using (status = 'published' and published_content is not null);

create policy seo_pages_admin_all
  on public.seo_pages
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy page_revisions_admin_all
  on public.page_revisions
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy redirects_public_read
  on public.redirects
  for select
  to anon, authenticated
  using (true);

create policy redirects_admin_all
  on public.redirects
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));
