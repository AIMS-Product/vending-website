-- Website Builder round 3 (S6a / I6) — data-driven builder route prefixes.
--
-- Stores the allowed top-level URL prefixes for SEO Page Builder pages so the
-- curated list is managed in Settings instead of being hardcoded. The five
-- built-in prefixes are seeded as non-deletable defaults; the service layer
-- (src/lib/services/route-prefixes.ts) falls back to the same five when this
-- table is absent, so app behavior never depends on this migration.

create table if not exists public.page_builder_route_prefixes (
  id          uuid primary key default gen_random_uuid(),
  prefix      text not null unique
              check (
                prefix ~ '^/[a-z0-9]+(-[a-z0-9]+)*$'
                and char_length(prefix) <= 40
              ),
  label       text not null default '',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.page_builder_route_prefixes enable row level security;

create policy page_builder_route_prefixes_admin_all
  on public.page_builder_route_prefixes
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

insert into public.page_builder_route_prefixes (prefix, label, is_default)
values
  ('/resources', 'Resources', true),
  ('/blog', 'Blog', true),
  ('/landing', 'Landing', true),
  ('/videos', 'Videos', true),
  ('/solutions', 'Solutions', true)
on conflict (prefix) do nothing;
