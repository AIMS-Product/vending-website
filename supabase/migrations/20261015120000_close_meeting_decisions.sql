-- Dom's booked_calls.v2.2 decision for every Close meeting created in the last
-- 70 days, rewritten by each hourly close-meetings sync. The engine runs in
-- TypeScript at read time; this table lets readers outside this app (the
-- vp-webinars room cards, via its service-role pull) join on Dom's rule
-- without a second copy of the engine. 70 days = the window whose lead origin
-- facts the sync keeps fresh; older decisions would drift to "source_unavailable".
create table if not exists public.close_meeting_decisions (
  meeting_id text primary key,
  lead_id text not null,
  -- Close `date_created`, Pacific calendar day: the day the call was booked.
  created_day date not null,
  disposition text not null check (disposition in ('counted', 'excluded', 'held')),
  reason text not null,
  -- Marketing / Lane 2 / Social DMs; null on rows the rule never assigned.
  booked_by text,
  rule_version text not null,
  computed_at timestamptz not null
);

create index if not exists close_meeting_decisions_lead_idx
  on public.close_meeting_decisions (lead_id);

alter table public.close_meeting_decisions enable row level security;

comment on table public.close_meeting_decisions is
  'Booked calls V2 (booked_calls.v2.2) decision per Close meeting created in the last 70 days. Rewritten hourly by /api/admin/close-meetings-sync/run. Service role only.';
