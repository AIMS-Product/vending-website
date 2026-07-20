-- Master funnel dashboard, Slice 1 — Calendly bookings
--
-- Security model:
--   * Calendly delivers webhooks to a signature-verified route handler that
--     uses the service-role client. Browsers never write directly to this
--     table.
--   * Authenticated app admins may read booking rows for operational
--     follow-up and dashboard reporting.
--   * No anon policies exist, so anonymous clients cannot read or write
--     booking data.
--   * `invitee_uri` is the Calendly invitee identifier and prevents duplicate
--     webhook retries from creating duplicate booking records.

create table public.calendly_bookings (
  id                   uuid primary key default gen_random_uuid(),
  invitee_uri          text not null unique,
  event_kind           text not null
                       check (event_kind in ('invitee.created', 'invitee.canceled')),
  status               text not null default 'booked'
                       check (status in ('booked', 'canceled')),
  invitee_name         text,
  invitee_email        text,
  scheduled_event_name text,
  scheduled_event_uri  text,
  event_start_at       timestamptz,
  event_end_at         timestamptz,
  canceled_at          timestamptz,
  cancel_reason        text,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  utm_term             text,
  utm_content          text,
  source_path          text,
  lead_submission_id   uuid references public.lead_submissions(id) on delete set null,
  raw_payload          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index calendly_bookings_created_idx
  on public.calendly_bookings (created_at desc);

create index calendly_bookings_event_start_idx
  on public.calendly_bookings (event_start_at);

create index calendly_bookings_invitee_email_lower_idx
  on public.calendly_bookings (lower(invitee_email));

create index calendly_bookings_lead_submission_id_idx
  on public.calendly_bookings (lead_submission_id);

create index calendly_bookings_scheduled_event_name_idx
  on public.calendly_bookings (scheduled_event_name);

create trigger calendly_bookings_set_updated_at
  before update on public.calendly_bookings
  for each row execute function public.set_updated_at();

alter table public.calendly_bookings enable row level security;

create policy calendly_bookings_admin_read
  on public.calendly_bookings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users u
      where u.user_id = auth.uid()
    )
  );
