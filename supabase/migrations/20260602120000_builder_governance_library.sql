create table if not exists public.page_builder_content_pieces (
  id uuid primary key default gen_random_uuid(),
  source_page_id uuid not null references public.seo_pages(id) on delete cascade,
  source_revision_id uuid not null references public.page_revisions(id) on delete cascade,
  source_block_id text not null,
  block_type text not null,
  block_variant text not null,
  page_type text not null,
  route_path text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  internal_tags text[] not null default '{}',
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_revision_id, source_block_id)
);

create index if not exists page_builder_content_pieces_page_idx
  on public.page_builder_content_pieces(source_page_id, created_at desc);

create index if not exists page_builder_content_pieces_type_idx
  on public.page_builder_content_pieces(block_type, page_type);

create trigger page_builder_content_pieces_set_updated_at
  before update on public.page_builder_content_pieces
  for each row execute function public.set_updated_at();

alter table public.page_builder_content_pieces enable row level security;

create policy page_builder_content_pieces_admin_all
  on public.page_builder_content_pieces
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

alter table public.seo_pages
  add column if not exists internal_tags text[] not null default '{}',
  add column if not exists topic_cluster text,
  add column if not exists campaign_label text,
  add column if not exists funnel_stage text,
  add column if not exists review_period_months integer not null default 6,
  add column if not exists next_review_at timestamptz,
  add column if not exists lifecycle_status text not null default 'drafting',
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists scheduled_publish_status text not null default 'none',
  add column if not exists scheduled_publish_error text,
  add column if not exists footer_variant jsonb not null default '{}'::jsonb;

alter table public.seo_pages
  drop constraint if exists seo_pages_review_period_months_check,
  add constraint seo_pages_review_period_months_check
    check (review_period_months in (3, 6, 9, 12, 15, 18));

alter table public.seo_pages
  drop constraint if exists seo_pages_lifecycle_status_check,
  add constraint seo_pages_lifecycle_status_check
    check (lifecycle_status in ('drafting', 'updating', 'needs_review', 'approved'));

alter table public.seo_pages
  drop constraint if exists seo_pages_scheduled_publish_status_check,
  add constraint seo_pages_scheduled_publish_status_check
    check (scheduled_publish_status in ('none', 'scheduled', 'cancelled', 'failed', 'published'));

create table if not exists public.page_builder_authors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  slug text not null unique,
  bio text,
  avatar_asset_id uuid references public.media_assets(id) on delete set null,
  role_title text,
  social_links jsonb not null default '{}'::jsonb,
  structured_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger page_builder_authors_set_updated_at
  before update on public.page_builder_authors
  for each row execute function public.set_updated_at();

alter table public.page_builder_authors enable row level security;

create policy page_builder_authors_admin_all
  on public.page_builder_authors
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

alter table public.seo_pages
  add column if not exists author_id uuid references public.page_builder_authors(id) on delete set null;

create table if not exists public.page_builder_comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.seo_pages(id) on delete cascade,
  block_id text,
  body text not null,
  resolved_at timestamptz,
  resolved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_builder_comments_page_idx
  on public.page_builder_comments(page_id, resolved_at, created_at desc);

create trigger page_builder_comments_set_updated_at
  before update on public.page_builder_comments
  for each row execute function public.set_updated_at();

alter table public.page_builder_comments enable row level security;

create policy page_builder_comments_admin_all
  on public.page_builder_comments
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
