-- GoHighLevel email stats, one cumulative snapshot per workflow per day.
--
-- GHL's only read for workflow email performance is
-- GET /emails/locations/{locationId}/campaigns/stats/workflow-campaigns/{id},
-- and it returns lifetime totals with no date range. So the connector stores
-- what it saw today and writes the difference against the previous snapshot
-- into channel_daily (impressions = sent, clicks = clicked). The first snapshot
-- of a workflow writes nothing to the spine: there is no prior to diff against,
-- and null means not observed.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- channel_daily. Aggregates only, nothing per contact.
create table if not exists public.ghl_email_stats (
  snapshot_day  date not null,
  workflow_id   text not null,
  workflow_name text not null,
  sent          integer not null default 0 check (sent >= 0),
  delivered     integer not null default 0 check (delivered >= 0),
  opened        integer not null default 0 check (opened >= 0),
  clicked       integer not null default 0 check (clicked >= 0),
  replied       integer not null default 0 check (replied >= 0),
  synced_at     timestamptz not null default now(),
  primary key (snapshot_day, workflow_id)
);

create index if not exists ghl_email_stats_workflow_day_idx
  on public.ghl_email_stats (workflow_id, snapshot_day desc);

alter table public.ghl_email_stats enable row level security;

comment on table public.ghl_email_stats is
  'Daily cumulative snapshot of GHL workflow email stats. channel_daily rows for ghl_email are the day-over-day difference. Service-role only.';
