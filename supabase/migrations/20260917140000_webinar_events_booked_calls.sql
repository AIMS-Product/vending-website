-- Show rate on the Webinar lane divides two different populations.
--
-- vp-webinars changed `showed`, `won` and `revenue` on 2026-09-16 to come from the booking-link join --
-- the people on the Booked Calls sheet -- because Close only sees a booking whose lead still carries the
-- event tag, and that tag goes missing on precisely the people who book. The denominator stayed
-- `booked_ever`, which is the tag cohort. The two sets cross in both directions, so the published rate is
-- wrong on nine of eleven events: Sept 1 read 25.7% against a real 60%, Aug 18 21.7% against 45.5%.
--
-- booked_calls is the count of record for bookings and the population `showed`/`won`/`revenue` are counted
-- over, so it is their denominator. booked_ever stays, disclosed as the tag cohort, and is no longer
-- divided into anything. Nullable: rows written before this ships carry null until the next ingest refills
-- them, and a null leaves the rate as a dash rather than falling back to the other population.
alter table public.webinar_events
  add column if not exists booked_calls integer;

comment on column public.webinar_events.booked_calls is
  'Bookings on the Booked Calls sheet: the count of record, and the denominator for showed/won/revenue.';
comment on column public.webinar_events.booked_ever is
  'Close tag-cohort lifetime bookings. Disclosed for comparison; never a denominator -- the tag goes missing on the people who book.';
