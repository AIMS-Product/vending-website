-- Show rate on the Webinar lane was showed / booked_within_7d: a lifetime numerator over a seven-day
-- denominator. june16 published 87 shows against 38 bookings, a 229% show rate, to /admin.
--
-- booked_ever is the cohort's lifetime booking count and is THE denominator for showed, won and revenue.
-- show_no_booking is leads a rep marked shown with no booked date; disclosed, never counted as a show.
-- Both are nullable: rows written before 2026-09-13 have neither until the next ingest push refills them.
alter table public.webinar_events
  add column if not exists booked_ever integer,
  add column if not exists show_no_booking integer;

comment on column public.webinar_events.booked_ever is
  'Lifetime bookings for the cohort. Divide showed/won/revenue by this, never by booked_within_7d.';
comment on column public.webinar_events.show_no_booking is
  'Leads marked shown in Close with no booked date. A data-quality count, never a show.';
