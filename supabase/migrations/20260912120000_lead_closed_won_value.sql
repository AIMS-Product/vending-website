-- The deal value behind a won lead.
--
-- The Close reconciler already reads each lead's opportunities to date the win
-- (`earliestWonDate`), and every won opportunity carries a value, but nothing
-- stored it. So the Revenue and Cost/booked columns were null for every
-- channel except webinars, whose revenue is typed into `webinar_events` by
-- hand.
--
-- Stored in DOLLARS. Close's API returns `value` as an integer number of
-- CENTS (verified against live data 2026-09-11: $5,997 comes back as 599700),
-- and the reconciler divides before writing, so this column reads the same way
-- as `webinar_events.revenue`.
--
-- Nullable and unconstrained in sign: a lead with no won opportunity has no
-- observed value, which is not the same as zero, and a refunded deal can
-- legitimately go negative in Close.
do $$
begin
  alter table public.lead_submissions
    add column if not exists closed_won_value numeric;

  comment on column public.lead_submissions.closed_won_value is
    'Sum of won Close opportunity values for this lead, in dollars. Null when no won opportunity carries a value.';
end
$$;
