-- SEO Page Builder Slice 8 — reusable content and approved source libraries.

create table public.proof_items (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null check (kind in ('testimonial', 'stat', 'case_study', 'quote')),
  name                  text,
  role_or_context       text,
  body                  text not null,
  asset_id              uuid references public.media_assets(id) on delete set null,
  source_rights_notes   text,
  approved              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.cta_presets (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  href            text not null,
  style_preset    text not null default 'primary',
  tracking_name   text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.source_documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  source_type   text not null check (source_type in ('paste', 'file', 'url_reference', 'existing_site_content')),
  body          text not null,
  asset_id      uuid references public.media_assets(id) on delete set null,
  tags          text[] not null default '{}'::text[],
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.source_excerpts (
  id                  uuid primary key default gen_random_uuid(),
  source_document_id  uuid not null references public.source_documents(id),
  excerpt             text not null,
  topic_tags          text[] not null default '{}'::text[],
  approved            boolean not null default false,
  approved_by         uuid,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.approved_claims (
  id                 uuid primary key default gen_random_uuid(),
  claim              text not null,
  claim_type         text not null default 'general',
  source_excerpt_id  uuid not null references public.source_excerpts(id),
  usage_notes        text,
  risk_level         text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  approved_by        uuid,
  approved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index proof_items_approved_idx on public.proof_items (approved, updated_at desc);
create index cta_presets_updated_idx on public.cta_presets (updated_at desc);
create index source_documents_tags_idx on public.source_documents using gin (tags);
create index source_excerpts_document_idx on public.source_excerpts (source_document_id);
create index source_excerpts_approved_idx on public.source_excerpts (approved, updated_at desc);
create index approved_claims_excerpt_idx on public.approved_claims (source_excerpt_id);
create index approved_claims_risk_idx on public.approved_claims (risk_level, updated_at desc);

create trigger proof_items_set_updated_at
  before update on public.proof_items
  for each row execute function public.set_updated_at();

create trigger cta_presets_set_updated_at
  before update on public.cta_presets
  for each row execute function public.set_updated_at();

create trigger source_documents_set_updated_at
  before update on public.source_documents
  for each row execute function public.set_updated_at();

create trigger source_excerpts_set_updated_at
  before update on public.source_excerpts
  for each row execute function public.set_updated_at();

create trigger approved_claims_set_updated_at
  before update on public.approved_claims
  for each row execute function public.set_updated_at();

alter table public.proof_items enable row level security;
alter table public.cta_presets enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_excerpts enable row level security;
alter table public.approved_claims enable row level security;

create policy proof_items_admin_all on public.proof_items
  for all to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy cta_presets_admin_all on public.cta_presets
  for all to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy source_documents_admin_all on public.source_documents
  for all to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy source_excerpts_admin_all on public.source_excerpts
  for all to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

create policy approved_claims_admin_all on public.approved_claims
  for all to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));
