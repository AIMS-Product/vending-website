-- Webinar aggregates, pushed by the vp-webinars GitHub Action.
--
-- One row per completed webinar, upserted by date on every run so maturing
-- cohorts (7-day booking window, 56-day revenue window) keep updating until
-- their windows close. Contract: vp-webinars
-- .claude/specs/2026-09-11-webinar-ingest-contract.md, version 1.
--
-- Aggregates only. The sender refuses anything person-shaped and there is
-- deliberately no column here for a name, email, phone or lead id.
-- Every metric is nullable: NULL MEANS NOT OBSERVED, never zero.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- channel_daily. Written by a bearer-authenticated route handler.
create table if not exists public.webinar_events (
  date                         date primary key,
  label                        text not null,
  format                       text not null,
  -- Meta spend for the whole account over the webinar's ads window, USD.
  spend                        numeric check (spend is null or spend >= 0),
  registrations                integer check (registrations is null or registrations >= 0),
  registrations_ad_attributed  integer check (registrations_ad_attributed is null or registrations_ad_attributed >= 0),
  attendees                    integer check (attendees is null or attendees >= 0),
  peak_attendees               integer check (peak_attendees is null or peak_attendees >= 0),
  attendees_at_offer           integer check (attendees_at_offer is null or attendees_at_offer >= 0),
  booked_within_7d             integer check (booked_within_7d is null or booked_within_7d >= 0),
  booked_night_of              integer check (booked_night_of is null or booked_night_of >= 0),
  showed                       integer check (showed is null or showed >= 0),
  won                          integer check (won is null or won >= 0),
  revenue                      numeric check (revenue is null or revenue >= 0),
  pitch_start_min              integer,
  length_min                   integer,
  notes                        text,
  booking_maturing             boolean not null default false,
  revenue_maturing             boolean not null default false,
  -- The sender's per-source pulledAt timestamps, kept for "how fresh is this".
  pulled_at                    jsonb not null default '{}'::jsonb,
  received_at                  timestamptz not null default now()
);

alter table public.webinar_events enable row level security;

comment on table public.webinar_events is
  'One row per completed webinar, pushed by vp-webinars after each snapshot refresh (contract v1). Upserted by date. NULL means not observed. Aggregates only; no identity columns by design.';
