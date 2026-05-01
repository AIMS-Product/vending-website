-- Slice 3b — News CMS schema
--
-- Tables:
--   news_posts          public-readable when status='published'
--   app_users           membership in this table grants admin write access
--   app_user_emails     email-only allowlist; new auth signups whose email
--                       matches an entry are auto-promoted into app_users
--
-- Security model:
--   * RLS is the boundary. anon role can SELECT only published rows.
--   * authenticated role can mutate news_posts only when their auth.uid()
--     resolves to a row in app_users.
--   * Service-role bypasses RLS — used from server-only admin code paths.

-- ---------------------------------------------------------------------------
-- 1. news_posts
-- ---------------------------------------------------------------------------

create table public.news_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  body            text not null,                  -- markdown source
  cover_url       text,
  cover_alt       text,
  author          text,
  status          text not null default 'draft'
                  check (status in ('draft', 'published', 'archived')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index news_posts_published_idx
  on public.news_posts (status, published_at desc);

create index news_posts_slug_idx
  on public.news_posts (slug);

-- ---------------------------------------------------------------------------
-- 2. app_users + email allowlist
-- ---------------------------------------------------------------------------

create table public.app_users (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text not null unique,
  role      text not null default 'editor' check (role in ('editor', 'admin')),
  added_at  timestamptz not null default now()
);

create table public.app_user_emails (
  email     text primary key,
  role      text not null default 'editor' check (role in ('editor', 'admin')),
  added_at  timestamptz not null default now()
);

-- Auto-promote magic-link signups whose email is on the allowlist into
-- app_users. Runs as security definer because the auth schema is owned
-- by the supabase_auth_admin role.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invite_role text;
begin
  select role into invite_role
    from public.app_user_emails
    where email = new.email;

  if invite_role is not null then
    insert into public.app_users (user_id, email, role)
      values (new.id, new.email, invite_role)
      on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger for news_posts
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger news_posts_set_updated_at
  before update on public.news_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

alter table public.news_posts       enable row level security;
alter table public.app_users        enable row level security;
alter table public.app_user_emails  enable row level security;

-- news_posts: anon and authenticated may read published rows
create policy news_posts_public_read
  on public.news_posts
  for select
  to anon, authenticated
  using (status = 'published');

-- news_posts: members of app_users may do anything
create policy news_posts_admin_all
  on public.news_posts
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));

-- app_users: a user can read their own row (used by /admin to confirm access)
create policy app_users_self_read
  on public.app_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- app_user_emails: no anon or authenticated access; service-role only.
-- (No policies = nothing allowed for non-service-role.)

-- ---------------------------------------------------------------------------
-- 5. Seed allowlist
-- ---------------------------------------------------------------------------

insert into public.app_user_emails (email, role)
  values ('james@modernamenities.com', 'admin')
  on conflict (email) do update set role = excluded.role;
