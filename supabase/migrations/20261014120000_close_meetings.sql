-- Booked calls V2 (Dom's rule `booked_calls.v2.2`, 2026-10-13) counts each
-- qualifying Close MEETING activity, dated by when the meeting was created,
-- with a 60-day repeat rule over the lead's whole scheduled history. The lead
-- mirror (`close_lead_funnel`) holds one row per lead and cannot answer that,
-- so the org's meetings are mirrored here, every one, refreshed hourly.
create table if not exists public.close_meetings (
  id text primary key,
  lead_id text not null,
  user_id text,
  user_name text,
  title text,
  status text,
  -- Close custom meeting outcome, by name ("No Show", "Cancelled", ...).
  outcome text,
  starts_at timestamptz,
  date_created timestamptz not null,
  date_updated timestamptz,
  -- The meeting's own note mentions a reschedule (Calendly writes one).
  -- The note itself is not stored: it can hold prospect details.
  reschedule_note boolean not null default false,
  synced_at timestamptz not null default now()
);

create index if not exists close_meetings_lead_idx
  on public.close_meetings (lead_id);
create index if not exists close_meetings_created_idx
  on public.close_meetings (date_created);

alter table public.close_meetings enable row level security;

-- Origin evidence for every lead that has a recent meeting: V2 resolves the
-- original source from Funnel Name, then contact UTMs, then Resource Tag.
-- Separate from `close_lead_funnel`, whose readers rely on it holding only
-- leads with a First Sales Call Booked Date.
create table if not exists public.close_meeting_leads (
  lead_id text primary key,
  funnel text,
  -- One entry per contact: [{ "source": "...", "medium": "..." }].
  contact_utms jsonb not null default '[]'::jsonb,
  resource_tag text,
  setter_name text,
  business_line text,
  synced_at timestamptz not null default now()
);

alter table public.close_meeting_leads enable row level security;

comment on table public.close_meetings is
  'Mirror of every Close meeting activity. Input to booked calls V2 (booked_calls.v2.2). Refreshed by /api/admin/close-meetings-sync/run.';
comment on table public.close_meeting_leads is
  'Origin fields for leads with a recent Close meeting. Input to booked calls V2 source resolution.';
