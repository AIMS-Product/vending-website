-- Which captures get forwarded to a partner's GoHighLevel, and where.
--
-- One row per destination; today that is WeScale, the paid-traffic agency
-- working our leads in their own GHL. The row is what /admin/settings/lead-
-- forwarding edits, so turning the feed on, changing the webhook URL or
-- dropping a capture type is an admin action rather than a redeploy.
--
-- What is NOT here: the private integration token and location id for the API
-- transport. Those stay Vercel env vars. A live partner token in a table is a
-- secret sitting somewhere it does not need to be, and rotating it is their
-- job, not a thing we should be storing.
--
-- The service (src/lib/services/lead-forward-settings.ts) treats a missing
-- table as "disabled", so app behaviour never depends on this migration being
-- applied — the feed simply stays off until it is.

create table if not exists public.lead_forward_settings (
  id                  text primary key,
  enabled             boolean not null default false,
  webhook_url         text,
  -- Which kinds of capture to send. Defaults are the three that asked to be
  -- contacted; lead-magnet downloads and newsletter signups are off because
  -- those people asked for a PDF or an email, not a call from an agency.
  capture_types       text[] not null default '{booking,application,chat}',
  -- 'all' forwards every traffic source, including ones that do not exist
  -- yet, so a new campaign is never silently dropped. 'allowlist' sends only
  -- the sources listed below, with '(none)' meaning "no utm_source".
  traffic_source_mode text not null default 'all'
                      check (traffic_source_mode in ('all', 'allowlist')),
  traffic_sources     text[] not null default '{}',
  -- Payload key -> GHL custom field id, for the API transport only.
  field_ids           jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  updated_by          text
);

alter table public.lead_forward_settings enable row level security;

create policy lead_forward_settings_admin_all
  on public.lead_forward_settings
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

insert into public.lead_forward_settings (id)
values ('wescale')
on conflict (id) do nothing;
