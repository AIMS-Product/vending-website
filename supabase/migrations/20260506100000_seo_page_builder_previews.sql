-- SEO Page Builder Slice 5 — draft preview tokens.
--
-- Raw preview tokens are shown once to admins and never stored. Public preview
-- rendering hashes the presented token and validates the row server-side.

create table public.page_preview_tokens (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.seo_pages(id),
  token_hash    text not null unique,
  token_prefix  text not null,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  check (expires_at > created_at)
);

create index page_preview_tokens_page_created_idx
  on public.page_preview_tokens (page_id, created_at desc);

create index page_preview_tokens_active_idx
  on public.page_preview_tokens (token_hash, expires_at)
  where revoked_at is null;

alter table public.page_preview_tokens enable row level security;

create policy page_preview_tokens_admin_all
  on public.page_preview_tokens
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));
