# Waiting on a hand-applied migration

The Supabase CLI is not linked in this repo, so these run in the SQL editor
(Supabase → SQL editor → paste → Run). All four are safe to run twice.

Paste this whole block:

```sql
-- 1. Thank-you page visits (20260912110000). Without it the nightly GA4 sync
-- logs "N rows failed to write" every night and the thank-you column is blank.
alter table public.channel_daily
  add column if not exists thankyou_visits integer;

-- 2. The nightly audit's history (20260919130000). Without it the audit still
-- runs and still alerts, but the EOD/EOW email says "unverified" because it
-- cannot read the night's verdicts back.
create table if not exists public.data_audit_runs (
  id           bigserial primary key,
  run_at       timestamptz not null default now(),
  check_id     text not null,
  label        text not null,
  window_label text not null,
  source_name  text not null,
  ours         numeric,
  source       numeric,
  diff_pct     numeric,
  status       text not null
    check (status in ('pass', 'warn', 'fail', 'skipped', 'error')),
  detail       text not null
);

create index if not exists data_audit_runs_run_at_idx
  on public.data_audit_runs (run_at desc);

create index if not exists data_audit_runs_check_idx
  on public.data_audit_runs (check_id, run_at desc);

alter table public.data_audit_runs enable row level security;

-- 3. Pre-call video engagement (20260921120000). Without it nothing records
-- which pre-call videos a booker watched: the player events are emitted and
-- silently dropped, and the Engagement column on /admin/bookings stays blank.
create table if not exists public.lead_video_views (
  vp_session_id   text not null,
  embed_id        text not null,
  max_percent     smallint not null default 0,
  page_path       text,
  first_played_at timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  primary key (vp_session_id, embed_id),
  constraint lead_video_views_percent_range
    check (max_percent between 0 and 100),
  constraint lead_video_views_session_len
    check (length(vp_session_id) <= 160),
  constraint lead_video_views_embed_len
    check (length(embed_id) <= 64),
  constraint lead_video_views_path_len
    check (page_path is null or length(page_path) <= 300)
);

create index if not exists lead_video_views_session_idx
  on public.lead_video_views (vp_session_id);

create index if not exists lead_video_views_last_seen_idx
  on public.lead_video_views (last_seen_at desc);

alter table public.lead_video_views enable row level security;

-- 4. Video length (20260921160000). Without it engagement can only be shown as
-- a percent, never as "watched 3 of the 5 minutes".
alter table public.lead_video_views
  add column if not exists duration_seconds integer;

alter table public.lead_video_views
  drop constraint if exists lead_video_views_duration_sane;

alter table public.lead_video_views
  add constraint lead_video_views_duration_sane
    check (duration_seconds is null
           or (duration_seconds > 0 and duration_seconds <= 28800));
```

Then re-run the audit so the first verdicts are stored:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://www.vendingpreneurs.com/api/admin/data-audit/run
```
