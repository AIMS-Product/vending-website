-- Slice 4 — lead capture schema
--
-- Security model:
--   * Public forms submit through server actions that use the service-role
--     client. Browsers never write directly to this table.
--   * Authenticated app admins may read lead rows for operational follow-up.
--   * No anon policies exist, so anonymous clients cannot read or write PII.
--   * `idempotency_key` prevents duplicate retries from creating duplicate
--     accepted lead records.

create table public.lead_submissions (
  id                         uuid primary key default gen_random_uuid(),
  idempotency_key            text not null unique,
  form_type                  text not null
                             check (form_type in ('apply', 'contact')),
  status                     text not null default 'received'
                             check (
                               status in (
                                 'received',
                                 'notified',
                                 'notification_failed',
                                 'archived'
                               )
                             ),
  full_name                  text not null,
  email                      text not null,
  phone                      text,
  city                       text,
  state_region               text,
  business_stage             text,
  budget                     text,
  timeline                   text,
  message                    text,
  source_path                text,
  landing_path               text,
  referrer                   text,
  user_agent                 text,
  utm_source                 text,
  utm_medium                 text,
  utm_campaign               text,
  utm_term                   text,
  utm_content                text,
  metadata                   jsonb not null default '{}'::jsonb,
  notification_attempted_at  timestamptz,
  notification_sent_at       timestamptz,
  notification_error         text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index lead_submissions_created_idx
  on public.lead_submissions (created_at desc);

create index lead_submissions_status_idx
  on public.lead_submissions (status, created_at desc);

create index lead_submissions_source_path_idx
  on public.lead_submissions (source_path);

create index lead_submissions_email_lower_idx
  on public.lead_submissions (lower(email));

create trigger lead_submissions_set_updated_at
  before update on public.lead_submissions
  for each row execute function public.set_updated_at();

alter table public.lead_submissions enable row level security;

create policy lead_submissions_admin_read
  on public.lead_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users u
      where u.user_id = auth.uid()
    )
  );
