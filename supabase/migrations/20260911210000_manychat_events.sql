-- Instagram DM funnel events, pushed by ManyChat flows.
--
-- One row per contact per stage per day, upserted so a flow that fires twice
-- for the same person on the same day counts once. The stages are the tags
-- the DM setter already applies (New Lead, Booking link sent, Call Booked,
-- Call Pitched, Booked Call Closed). Contract:
-- docs/marketing/manychat-ingest.md, version 1.
--
-- Identity columns are kept on purpose, unlike webinar_events: a Calendly
-- booking has no ManyChat id, so email and phone are the only way a booking
-- joins back to the DM that earned it.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- channel_daily. Written by a bearer-authenticated route handler.
create table if not exists public.manychat_events (
  subscriber_id  text not null,
  event          text not null check (event in (
                   'new_lead', 'booking_link_sent', 'call_booked',
                   'call_pitched', 'closed')),
  day            date not null,
  occurred_at    timestamptz not null,
  ig_username    text,
  email          text,
  phone          text,
  subscribed_at  timestamptz,
  -- Tag names on the contact at the time of the event, from the ManyChat API.
  tags           jsonb not null default '[]'::jsonb,
  -- True when the row was filled from the ManyChat API, not just the payload.
  enriched       boolean not null default false,
  received_at    timestamptz not null default now(),
  primary key (subscriber_id, event, day)
);

create index if not exists manychat_events_day_idx on public.manychat_events (day);

alter table public.manychat_events enable row level security;

comment on table public.manychat_events is
  'Instagram DM funnel stages per contact per day, pushed by ManyChat flows (contract v1) and enriched from the ManyChat API. Rolled up onto channel_daily as channel Instagram DM.';
