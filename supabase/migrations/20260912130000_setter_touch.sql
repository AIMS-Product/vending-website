-- Who worked a lead in Close right before they booked themselves.
--
-- Most booked calls carry nothing that says who set them: the lead clicked a
-- link somebody texted them, and an untagged Calendly link records no sender.
-- Close does record the call or SMS that came first, so the reconciler derives
-- the last setter to touch the lead before the booking and stores it here.
--
-- Kept in its own columns rather than written into booked_by_setter on purpose.
-- That column is what a human stated in Close; this is what we inferred from
-- activity, and the ledger ranks them differently and says which it used. One
-- column holding both would make a guess indistinguishable from a fact.
alter table public.lead_submissions
  add column if not exists setter_touch_name text,
  add column if not exists setter_touch_at timestamptz;

comment on column public.lead_submissions.setter_touch_name is
  'Setter whose call/SMS in Close came last before this lead booked. Inferred, not stated: see booked_by_setter for the human-entered value.';
comment on column public.lead_submissions.setter_touch_at is
  'When that touch happened, so the ledger can show how close it was to the booking.';
