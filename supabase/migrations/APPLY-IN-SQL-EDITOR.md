# Waiting on a hand-applied migration

The Supabase CLI is not linked in this repo, so these run in the SQL editor
(Supabase → SQL editor → paste → Run). All five are safe to run twice.

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

-- 5. Monotonic video progress (20260921180000). Without it simultaneous
-- milestones race and the LOWER number can win.
create or replace function public.record_video_view(
  p_vp_session_id   text,
  p_embed_id        text,
  p_percent         smallint,
  p_page_path       text default null,
  p_duration_seconds integer default null,
  p_occurred_at     timestamptz default now()
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.lead_video_views as v (
    vp_session_id, embed_id, max_percent, page_path,
    duration_seconds, first_played_at, last_seen_at
  )
  values (
    p_vp_session_id, p_embed_id, p_percent, p_page_path,
    p_duration_seconds, p_occurred_at, p_occurred_at
  )
  on conflict (vp_session_id, embed_id) do update set
    -- The whole point: progress never goes backwards.
    max_percent = greatest(v.max_percent, excluded.max_percent),
    -- Keep the first non-null length we ever saw; a later event that could not
    -- read a duration must not erase one that could.
    duration_seconds = coalesce(v.duration_seconds, excluded.duration_seconds),
    page_path = coalesce(v.page_path, excluded.page_path),
    -- Earliest play stands; recency always moves forward.
    first_played_at = least(v.first_played_at, excluded.first_played_at),
    last_seen_at = greatest(v.last_seen_at, excluded.last_seen_at);
$$;

comment on function public.record_video_view is
  'Upserts one video view, keeping the furthest point reached. security definer because lead_video_views is RLS-enabled with no policies (service-role only).';

-- The function is the only intended way in; it runs as owner, so nothing else
-- needs the table granted.
revoke all on function public.record_video_view from public, anon, authenticated;
```

## 6. Booking -> browser link (20260923120000)

Separate paste, safe to run twice. Without it, pre-call videos watched by
people who booked on the site's own calendar but never filled a site form
(webinar attendees on /start) stay "No session" on the Pre-call video tab and
/admin/bookings. The site code works with or without it; links are only
recorded once this exists.

```sql
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
```

Then re-run the audit so the first verdicts are stored:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://www.vendingpreneurs.com/api/admin/data-audit/run
```

## 7. Newsletter subscriptions (20260923230000)

Separate paste, safe to run twice. **Apply before merging the roadmap
newsletter PR**: until this column exists, every roadmap download and
/newsletter signup fails its lead update. It also marks every existing
/newsletter subscriber. Past roadmap downloads are left alone, because their
form never mentioned the newsletter.

```sql
alter table public.lead_submissions
  add column if not exists newsletter_subscribed_at timestamptz;

comment on column public.lead_submissions.newsletter_subscribed_at is
  'When this person agreed to get The Route (/newsletter signup, or a roadmap download whose form showed the newsletter notice). Null = not subscribed. Independent of lifecycle_status.';

-- Existing /newsletter subscribers, from the consent their signup recorded.
-- Roadmap downloads before this change are deliberately NOT backfilled: their
-- form never told them about the newsletter.
update public.lead_submissions as lead
set newsletter_subscribed_at = consent.first_consent_at
from (
  select lead_submission_id, min(consent_accepted_at) as first_consent_at
  from public.qualification_sessions
  where form_id = '7f5d8f76-2e5a-4e50-9b6f-8e92b3d9a401' -- NEWSLETTER_FORM_ID
    and consent_accepted_at is not null
  group by lead_submission_id
) as consent
where lead.id = consent.lead_submission_id
  and lead.newsletter_subscribed_at is null;
```
