-- Which browser made each booking, recorded at the moment of booking.
--
-- The gap this closes: pre-call video views are keyed on the first-party
-- session id (`vp_sid`), and until now the only way to get from a booking to a
-- session was through a site lead row. Webinar attendees book on /start
-- without ever filling a site form, so they had no lead row and every video
-- they watched was unattributable. Measured 2026-09-23: 18 browsers watched
-- after the muted-autoplay fix, 3 could be named, and 10 of the other 15 had
-- come straight from the webinar booking page.
--
-- The embedded Calendly posts `calendly.event_scheduled` with the invitee URI
-- to the page that hosts it, in the same browser that then lands on
-- /pre-call-resources. That pair is written here. No link parameter, nothing
-- in a URL, no email anywhere.
--
-- First write wins. The writer uses ON CONFLICT DO NOTHING, so a replayed or
-- forged event cannot move a booking onto a different browser once linked.
-- Invitee URIs are Calendly UUIDs and are never shown to anyone but the
-- invitee's own browser.

create table if not exists public.calendly_booking_sessions (
  invitee_uri   text primary key,
  vp_session_id text not null,
  linked_at     timestamptz not null default now(),
  constraint calendly_booking_sessions_uri_len
    check (length(invitee_uri) <= 300),
  constraint calendly_booking_sessions_session_len
    check (length(vp_session_id) <= 160)
);

create index if not exists calendly_booking_sessions_session_idx
  on public.calendly_booking_sessions (vp_session_id);

alter table public.calendly_booking_sessions enable row level security;

comment on table public.calendly_booking_sessions is
  'Invitee URI -> first-party session id, written by POST /api/attribution/events (booking_linked) when a visitor books in an on-site Calendly embed. Lets pre-call video views be attributed to bookers with no site lead row (webinar attendees). Service-role only.';
