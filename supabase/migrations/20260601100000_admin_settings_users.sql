-- Admin Settings users and password-auth role model.
--
-- This migration collapses the old content-oriented `editor` role into
-- `admin`, adds a real `super_admin` account-governance role, and creates a
-- narrow account audit table for invite/reset/role/removal events.

update public.app_user_emails
  set role = 'admin'
  where role = 'editor';

update public.app_users
  set role = 'admin'
  where role = 'editor';

alter table public.app_user_emails
  drop constraint if exists app_user_emails_role_check;

alter table public.app_user_emails
  add constraint app_user_emails_role_check
  check (role in ('admin', 'super_admin'));

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('admin', 'super_admin'));

update public.app_user_emails
  set role = 'super_admin'
  where lower(email) = 'james@modernamenities.com';

update public.app_users
  set role = 'super_admin'
  where user_id in (
    select id
    from auth.users
    where lower(email) = 'james@modernamenities.com'
  );

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users u
    where u.user_id = auth.uid()
      and u.role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.is_app_admin() from public, anon, authenticated;
grant execute on function public.is_app_admin() to authenticated, service_role;

create or replace function public.is_app_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users u
    where u.user_id = auth.uid()
      and u.role = 'super_admin'
  );
$$;

revoke all on function public.is_app_super_admin() from public, anon, authenticated;
grant execute on function public.is_app_super_admin() to authenticated, service_role;

create table if not exists public.app_user_events (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null
                  check (
                    event_type in (
                      'invited',
                      'setup_resent',
                      'password_reset_sent',
                      'role_changed',
                      'access_removed',
                      'auth_user_disabled',
                      'self_lockout_blocked'
                    )
                  ),
  actor_user_id   uuid references auth.users(id) on delete set null,
  actor_email     text not null,
  target_user_id  uuid references auth.users(id) on delete set null,
  target_email    text not null,
  old_role        text check (old_role is null or old_role in ('admin', 'super_admin')),
  new_role        text check (new_role is null or new_role in ('admin', 'super_admin')),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists app_user_events_created_at_idx
  on public.app_user_events (created_at desc);

create index if not exists app_user_events_target_email_idx
  on public.app_user_events (target_email);

alter table public.app_user_events enable row level security;

drop policy if exists app_user_events_admin_read on public.app_user_events;
create policy app_user_events_admin_read
  on public.app_user_events
  for select
  to authenticated
  using (public.is_app_admin());
