-- Booking attribution: record whether a website lead went on to book a call.
--
-- Source of truth is Close ("First Call Booked Date"), not the Calendly
-- webhook: Close covers every calendar including ones this site never renders,
-- it already holds the history, and we store close_lead_id on each synced lead
-- so the join is exact rather than an email guess.

alter table public.lead_submissions
  add column if not exists call_booked_at date,
  add column if not exists call_status text,
  add column if not exists call_reconciled_at timestamptz;

comment on column public.lead_submissions.call_booked_at is
  'Date of the first sales call booked, mirrored from the Close lead custom field "First Call Booked Date". Null means no call has ever been booked.';
comment on column public.lead_submissions.call_status is
  'Close lead status label at the last reconcile (e.g. "Call Booked", "No Show"), or "close_lead_missing" when the Close lead has been deleted.';
comment on column public.lead_submissions.call_reconciled_at is
  'When this row was last checked against Close. Drives the reconciler batch ordering.';

-- The reconciler claims the least-recently-checked rows that have a Close lead.
create index if not exists lead_submissions_call_reconcile_idx
  on public.lead_submissions (call_reconciled_at nulls first)
  where close_lead_id is not null;

-- Analytics rolls conversion up by page over a date window.
create index if not exists lead_submissions_call_booked_idx
  on public.lead_submissions (call_booked_at)
  where call_booked_at is not null;
