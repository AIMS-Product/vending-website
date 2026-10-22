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

## 8. SEO command center (20260929120000 to 20260929125000)

Six files, pasted **in this order**, each safe to run twice (verified on a
scratch Postgres 17, applied twice). They only create new `seo_*` and
`social_account_daily` tables and seed the plan; nothing existing is altered.
Until they exist, /admin/seo shows a setup note and the new connectors log
`skipped: table missing`, not failures.

1. `20260929120000_seo_search_console.sql` (Search Console by day, page, query)
2. `20260929121000_seo_keywords_ranks.sql` (tracked keywords, DataForSEO snapshots)
3. `20260929122000_seo_content_tasks.sql` (content plan, tasks)
4. `20260929123000_seo_social_reviews.sql` (social account days, monthly reviews)
5. `20260929124000_seo_seed.sql` (63 pieces, 223 keywords, 51 starter tasks;
   `on conflict do nothing`, so it never overwrites edits made on the page)
6. `20260929125000_seo_budget_competitors.sql` (DataForSEO spend ledger for
   the monthly cap, monthly competitor keywords)

Then backfill once (production, with the cron secret):

```
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.vendingpreneurs.com/api/admin/search-console-sync/run?days=500"
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.vendingpreneurs.com/api/admin/metricool-sync/run?days=400"
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.vendingpreneurs.com/api/admin/seo-triggers/run"
# after DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are set in Vercel:
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.vendingpreneurs.com/api/admin/seo-ranks/run?full=1"
```

## 9. SEO Day 0 baseline (20260930120000)

One file, safe to run twice: `20260930120000_seo_baselines.sql`. It creates
`seo_baselines` only. Until it exists, the Overview shows no "vs Day 0" line.
Then run `node --env-file=.env.local scripts/seo-day0.mjs` once (insert only,
never overwrites a frozen value).

Also paste `20260930121000_seo_ai_checks.sql` (AI Mode, ChatGPT, YouTube and
LLM Mentions checks). Until it exists the AI visibility job logs
`skipped: table missing`.

## 10. Kit newsletter sync (20261001120000)

Without it website newsletter signups save but never reach Kit (the queue
insert is rejected and logged). Set `KIT_API_KEY` in Vercel too.

```sql
alter table public.close_sync_events
  drop constraint if exists close_sync_events_event_type_check;

alter table public.close_sync_events
  add constraint close_sync_events_event_type_check
  check (
    event_type in (
      'lead_create_or_update',
      'qualification_enrichment',
      'newsletter_enrichment',
      'stale_follow_up_task',
      'manual_retry',
      'warm_reply_activity',
      'ghl_forward',
      'kit_subscribe'
    )
  );
```

## 11. ManyChat accounts + DM backfill (20261008120000, 20261008121000)

Without the first, a ManyChat flow event fails to save (no flow sends one yet).
Without the second, `scripts/manychat-backfill.mjs --apply` has nowhere to write.
Both are safe to run twice. Paste this whole block:

```sql
-- ManyChat runs one page per Instagram account (Mike, Anthony), each with its
-- own API key. Events carry the account so enrichment uses the right key and
-- the Instagram DM funnel splits per account. Every row before this migration
-- came from Mike's page (the only key that existed), hence the default.
-- Subscriber ids are page-scoped (one person on both pages has two ids), so
-- the primary key is unchanged.
alter table public.manychat_events
  add column if not exists account text not null default 'mike'
    check (account in ('mike', 'anthony'));

create index if not exists manychat_events_day_account_idx
  on public.manychat_events (day, account);

-- Instagram DM history, backfilled from ManyChat and joined to Close leads.
--
-- ManyChat cannot list its contacts and its Instagram contacts carry no email
-- or phone, so history is rebuilt one lead at a time
-- (scripts/manychat-backfill.mjs): each Close lead on an Instagram funnel, or
-- who booked through a setter's DM link, is looked up by the ManyChat id in
-- that link and by name, and every candidate is scored on independent
-- evidence (scripts/lib/manychat-match.mjs).
--
-- Every outcome is stored, not just the good ones, so the audit can see what
-- was left out and why. Readers count `level = 'confirmed'` only; anything
-- else is shown as unmatched, never as a DM.
--
-- Security model: service-role only (RLS enabled, no policies), matching
-- manychat_events.

create table if not exists public.manychat_contacts (
  account             text not null check (account in ('mike', 'anthony')),
  subscriber_id       text not null,
  ig_username         text,
  name                text,
  subscribed_at       timestamptz,
  last_interaction_at timestamptz,
  -- The keyword the contact commented or DM'd (Mike's OptinKeyword field).
  optin_keyword       text,
  tags                jsonb not null default '[]'::jsonb,
  custom_fields       jsonb not null default '[]'::jsonb,
  fetched_at          timestamptz not null default now(),
  primary key (account, subscriber_id)
);

create table if not exists public.manychat_lead_matches (
  close_lead_id   text primary key,
  level           text not null check (level in (
                    'confirmed', 'single', 'ambiguous', 'conflict', 'after')),
  -- Null unless one contact was picked (confirmed or single).
  account         text check (account in ('mike', 'anthony')),
  subscriber_id   text,
  -- Evidence on the picked contact: link, name, handle, tag.
  signals         text[] not null default '{}',
  -- Every candidate considered, with its own evidence and level.
  candidates      jsonb not null default '[]'::jsonb,
  -- Bumped when the rules in manychat-match.mjs change, so old rows can be redone.
  rules_version   int not null,
  matched_at      timestamptz not null default now(),
  check ((level in ('confirmed', 'single')) = (subscriber_id is not null))
);

create index if not exists manychat_lead_matches_confirmed_idx
  on public.manychat_lead_matches (account, subscriber_id)
  where level = 'confirmed';

alter table public.manychat_contacts enable row level security;
alter table public.manychat_lead_matches enable row level security;

comment on table public.manychat_contacts is
  'ManyChat contacts per Instagram account, fetched by the backfill for Close leads. Service-role only.';
comment on table public.manychat_lead_matches is
  'Close lead -> ManyChat contact, with evidence. Count level = confirmed only; other levels are kept for audit.';
```

## 13. YouTube plays by location (20261014150000)

Without it the `youtube-playback` connector records `skipped: table missing`
every run and nothing says where videos were watched. Numbered 13 because
section 12 is the UTM registry (PR #170). Safe to run twice; paste the whole
file `supabase/migrations/20261014150000_youtube_playback.sql`:

```sql
-- YouTube views by where they were played, per video per day.
--
-- YouTube Analytics "video playback location" report as the channel owner
-- (yt-analytics.readonly): dimensions=day,insightPlaybackLocationType,
-- filters=video==<id>. EMBEDDED is a play inside an embed on another site
-- (ours, mostly); WATCH, BROWSE, SEARCH, SHORTS and the rest are on YouTube.
-- `views` follows YouTube's public counting, which from late August 2026
-- counts autoplay from the first frame; `engaged_views` is the older, stricter
-- count and is the one to read as "really watched". NULL means the API did
-- not return that metric, never zero. Only rows YouTube returns are stored
-- (a day with no plays in a location has no row).
--
-- Security model: service-role only (RLS enabled, no policies).
create table if not exists public.youtube_video_playback_daily (
  video_id          text not null,
  day               date not null,
  location_type     text not null,
  views             integer check (views is null or views >= 0),
  engaged_views     integer check (engaged_views is null or engaged_views >= 0),
  minutes_watched   integer check (minutes_watched is null or minutes_watched >= 0),
  synced_at         timestamptz not null default now(),
  primary key (video_id, day, location_type)
);

create index if not exists youtube_video_playback_daily_day_idx
  on public.youtube_video_playback_daily (day desc, location_type);

alter table public.youtube_video_playback_daily enable row level security;

comment on table public.youtube_video_playback_daily is
  'YouTube Analytics views, engaged views and minutes watched per video per day per playback location. Service-role only.';

-- Which sites and pages the EMBEDDED plays came from, per video per calendar
-- month. YouTube's detail report has no day dimension and returns at most the
-- top 25 pages, so this is a monthly top-25, not a complete list; the daily
-- table above holds the complete EMBEDDED total.
create table if not exists public.youtube_video_embed_pages (
  video_id          text not null,
  month             date not null check (extract(day from month) = 1),
  page              text not null,
  views             integer check (views is null or views >= 0),
  engaged_views     integer check (engaged_views is null or engaged_views >= 0),
  minutes_watched   integer check (minutes_watched is null or minutes_watched >= 0),
  synced_at         timestamptz not null default now(),
  primary key (video_id, month, page)
);

create index if not exists youtube_video_embed_pages_month_idx
  on public.youtube_video_embed_pages (month desc);

alter table public.youtube_video_embed_pages enable row level security;

comment on table public.youtube_video_embed_pages is
  'Top 25 embedding pages per video per month (YouTube playback location detail, EMBEDDED). Service-role only.';

-- How far each video has been synced, so the connector backfills a video's
-- whole history once and then only re-reads a trailing window, and a run cut
-- off by its time budget resumes where it stopped.
create table if not exists public.youtube_playback_sync_state (
  video_id          text primary key,
  synced_through    date not null,
  synced_at         timestamptz not null default now()
);

alter table public.youtube_playback_sync_state enable row level security;

comment on table public.youtube_playback_sync_state is
  'Last day synced into youtube_video_playback_daily per video. Service-role only.';
```

## 14. $5 First Location Playbook (20261020002951)

New tables only (`ltf_visitors`, `ltf_events`, `ltf_orders`) and the `ltf_report` view. The `ltf-playbook` bucket already exists (created via the storage API); the insert below is a no-op. Safe to re-run.

```sql
-- LTF V2: the $5 First Location Playbook, sold through Stripe Checkout on our
-- own pages (plans/ltf-v2-pdf-ab). Replaces the GHL playbook course funnel.
-- Written only by server code with the service role; RLS on with no policies
-- so anon/auth roles read nothing.

-- One row per visitor who reached the offer. The conversion denominator.
create table if not exists public.ltf_visitors (
  visitor_id uuid primary key,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  -- Link unfurlers and crawlers: tracked (so the page renders) but left out of the report.
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);

-- Funnel steps per visitor. Unique per visitor + kind so reloads count once.
create table if not exists public.ltf_events (
  visitor_id uuid not null references public.ltf_visitors (visitor_id),
  kind text not null check (kind in ('offer_view', 'checkout_start')),
  created_at timestamptz not null default now(),
  primary key (visitor_id, kind)
);

-- One row per Stripe Checkout Session.
create table if not exists public.ltf_orders (
  id uuid primary key default gen_random_uuid(),
  -- Stripe Checkout Session id (cs_...). One session = one order.
  external_id text not null unique,
  visitor_id uuid references public.ltf_visitors (visitor_id),
  utm_source text,
  utm_campaign text,
  -- Stripe hosted checkout URL while the session is open (reused on repeat clicks).
  checkout_url text,
  checkout_expires_at timestamptz,
  email text,
  name text,
  -- Collected by Stripe Checkout so the sales team can reach buyers.
  phone text,
  amount_cents integer,
  fee_cents integer,
  currency text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sending', 'sent', 'failed')),
  delivery_error text,
  -- Random download token, minted with the order. Only a paid, unrefunded order
  -- serves the PDF, so a token on an unpaid order unlocks nothing.
  access_token text not null unique,
  payment_intent_id text,
  payment_failures integer not null default 0,
  refunded_cents integer not null default 0,
  download_count integer not null default 0,
  last_downloaded_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ltf_orders_visitor_idx on public.ltf_orders (visitor_id);
create index if not exists ltf_orders_payment_intent_idx on public.ltf_orders (payment_intent_id);
-- Emails are stored lower-case by the server.
create index if not exists ltf_orders_email_idx on public.ltf_orders (email);

alter table public.ltf_visitors enable row level security;
alter table public.ltf_events enable row level security;
alter table public.ltf_orders enable row level security;

-- Private bucket for the PDF. Served only through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('ltf-playbook', 'ltf-playbook', false)
on conflict (id) do nothing;

-- One-row funnel summary for /admin/analytics/ltf-test. Bots left out of visitors.
create or replace view public.ltf_report
with (security_invoker = true) as
select
  (select count(*) from public.ltf_visitors v where not v.is_bot) as visitors,
  (select count(*) from public.ltf_events e
     join public.ltf_visitors v using (visitor_id)
     where not v.is_bot and e.kind = 'offer_view') as offer_views,
  (select count(*) from public.ltf_events e
     join public.ltf_visitors v using (visitor_id)
     where not v.is_bot and e.kind = 'checkout_start') as checkout_starts,
  (select count(*) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded')) as buyers,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'refunded') as refunds,
  (select coalesce(sum(o.amount_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded')) as gross_cents,
  (select coalesce(sum(o.fee_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded')) as fee_cents,
  (select coalesce(sum(o.refunded_cents), 0) from public.ltf_orders o) as refunded_cents,
  (select coalesce(sum(o.payment_failures), 0) from public.ltf_orders o) as payment_failures,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'paid' and o.delivery_status = 'failed') as delivery_failures,
  (select count(*) from public.ltf_orders o where o.download_count > 0) as buyers_downloaded;

-- Safe to re-run: adds phone if the table was created before it was added.
alter table public.ltf_orders add column if not exists phone text;
```

## 15. $5 Playbook report: $0 promo orders are not buyers (20261022000000)

Replaces the `ltf_report` view only (no table changes, safe to re-run). Run after section 14.

```sql
-- $5 Playbook report: a 100% off promo order (code PLAYBOOKTEST) is not a buyer.
-- Before this, the two $0 test orders from 10-20 showed as "Paid buyers" and
-- inflated conversion. Buyers, revenue and downloads now count orders that
-- charged money; $0 orders get their own column (appended: a view can only
-- gain columns at the end). Delivery failures still count every paid order.
create or replace view public.ltf_report
with (security_invoker = true) as
select
  (select count(*) from public.ltf_visitors v where not v.is_bot) as visitors,
  (select count(*) from public.ltf_events e
     join public.ltf_visitors v using (visitor_id)
     where not v.is_bot and e.kind = 'offer_view') as offer_views,
  (select count(*) from public.ltf_events e
     join public.ltf_visitors v using (visitor_id)
     where not v.is_bot and e.kind = 'checkout_start') as checkout_starts,
  (select count(*) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded') and o.amount_cents > 0) as buyers,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'refunded' and o.amount_cents > 0) as refunds,
  (select coalesce(sum(o.amount_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded') and o.amount_cents > 0) as gross_cents,
  (select coalesce(sum(o.fee_cents), 0) from public.ltf_orders o
     where o.payment_status in ('paid', 'refunded') and o.amount_cents > 0) as fee_cents,
  (select coalesce(sum(o.refunded_cents), 0) from public.ltf_orders o) as refunded_cents,
  (select coalesce(sum(o.payment_failures), 0) from public.ltf_orders o) as payment_failures,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'paid' and o.delivery_status = 'failed') as delivery_failures,
  (select count(*) from public.ltf_orders o
     where o.download_count > 0 and o.amount_cents > 0) as buyers_downloaded,
  (select count(*) from public.ltf_orders o
     where o.payment_status = 'paid' and coalesce(o.amount_cents, 0) = 0) as free_orders;
```
