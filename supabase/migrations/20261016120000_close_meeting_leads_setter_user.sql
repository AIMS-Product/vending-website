-- Booked calls V2 (booked_calls.v2.6): Pearl's Social DM gate reads the lead's
-- setter user field (Close user id), not only the setter name text field.
alter table public.close_meeting_leads
  add column if not exists setter_user_id text;
