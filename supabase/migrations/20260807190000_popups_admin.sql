-- /admin/popups: popup campaigns move from the code array in
-- `src/lib/content/popups.ts` to this table so admins can create, edit, and
-- activate them without a deploy. Columns mirror the `Popup` type; the
-- `active` boolean becomes a three-state `status` (draft | active | paused)
-- and only `active` rows are served to visitors.
--
-- NOT YET APPLIED. Apply via the Management API query endpoint, never
-- `supabase db push` (remote migration history is drifted — see
-- .claude/specs/2026-08-07-popups-slice-3-admin.md).

create table if not exists public.popups (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused')),
  trigger text not null
    check (trigger in ('IMMEDIATE', 'TIME_ON_PAGE', 'SCROLL_DEPTH', 'IDLE_TIME', 'EXIT_INTENT')),
  -- Seconds for TIME_ON_PAGE/IDLE_TIME, percent for SCROLL_DEPTH.
  trigger_threshold numeric,
  -- Path substrings; empty = every page. /admin is always excluded in code.
  target_url_patterns text[] not null default '{}',
  frequency text not null default 'session'
    check (frequency in ('session', 'once_per_day', 'always')),
  eyebrow text,
  headline text not null,
  body text not null,
  primary_cta_label text not null,
  primary_cta_href text not null,
  secondary_cta_label text,
  secondary_cta_href text,
  featured_value_label text,
  featured_value_value text,
  featured_value_note text,
  offer_code text,
  dismiss_text text,
  accent_color text,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.popups enable row level security;

create policy popups_admin_all
  on public.popups
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

comment on table public.popups is
  'Site popup campaigns managed at /admin/popups. Only status=active rows are served to visitors.';

-- Analytics for the four stat tiles (shown / CTA clicks / converted /
-- dismissed). Written by /api/attribution/events alongside the money-page
-- forward — the forward is fire-and-forget with no queryable readback, so
-- this narrow table is the tiles' source of truth. `popup_id` is text, not a
-- FK: the static fallback popups ("exit-apply") emit events too, and stats
-- must survive a popup row being deleted.
create table if not exists public.popup_events (
  id bigserial primary key,
  popup_id text not null,
  event_type text not null
    check (event_type in ('popup_shown', 'popup_cta_clicked', 'popup_converted', 'popup_dismissed')),
  page_path text,
  occurred_at timestamptz not null default now()
);

create index if not exists popup_events_popup_type_idx
  on public.popup_events (popup_id, event_type);

-- Service-role only, same as public_request_hits: RLS on with no policies.
alter table public.popup_events enable row level security;

comment on table public.popup_events is
  'Popup analytics counters for /admin/popups stat tiles. Written server-side by the attribution events route.';

-- Seed the two campaigns that shipped in code (both were active:false) as
-- drafts, so the admin list starts with the real campaigns instead of empty.
-- Fixed UUIDs keep this idempotent under `on conflict`.
insert into public.popups (
  id, status, trigger, trigger_threshold, target_url_patterns, frequency,
  eyebrow, headline, body,
  primary_cta_label, primary_cta_href,
  secondary_cta_label, secondary_cta_href,
  dismiss_text
) values
  (
    'f7a1c6e2-0b3d-4a5e-9c8f-1d2e3f4a5b6c', 'draft', 'EXIT_INTENT', null, '{}', 'once_per_day',
    'Before you go', 'Not sure where to start with vending?',
    'See how Vendingpreneurs members find locations, place machines, and build monthly income — no experience required.',
    'Watch the free training', '/contact',
    'See member case studies', '/case-studies',
    'No thanks, I''m just browsing'
  ),
  (
    'a2b3c4d5-6e7f-4a8b-9c0d-1e2f3a4b5c6d', 'draft', 'SCROLL_DEPTH', 50, '{"/case-studies"}', 'session',
    null, 'Get the free vending business roadmap',
    'A step-by-step launch checklist covering machines, locations, and your first 90 days.',
    'Grab the roadmap', '/resources',
    null, null,
    'Maybe later'
  )
on conflict (id) do nothing;
