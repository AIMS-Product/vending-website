-- Which videos a prospect actually watched, keyed on the same first-party
-- session id the lead row already carries.
--
-- The gap this closes: a booker is redirected to /pre-call-resources and shown
-- fifteen Vidalytics videos, and nothing anywhere records whether they pressed
-- play. Vidalytics' own dashboard has plays and watch time, but per anonymous
-- visitor, behind a login marketing holds, with no bridge into anything we can
-- query. A rep cannot tell an engaged prospect from a cold one.
--
-- Grain is one row per session per video, holding the furthest point reached.
-- A replay is not a second view and a reload is not a second view, so the
-- natural key is the pair and progress only ever moves up. That is what makes
-- "watched 6 of 15" a countable thing rather than an event stream someone has
-- to aggregate correctly every time they ask.
--
-- Deliberately NOT modelled: per-play sessions, drop-off curves, rewatch
-- counts. The question on the table is "is this person engaged, and where did
-- they stop", and the max answers both. Vidalytics still holds the fine grain
-- if anyone ever needs the curve.

create table if not exists public.lead_video_views (
  vp_session_id   text not null,
  embed_id        text not null,
  -- Furthest point reached, in whole percent. Milestone-quantised by the
  -- client (25/50/75/100) — storing every timeupdate would be a write per
  -- quarter second per player.
  max_percent     smallint not null default 0,
  -- Where they were watching. One page today; the players are reused on
  -- /contact and the booking pages, so the column keeps those separable.
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

-- The rep-facing read is "these sessions, what did they watch", driven by a
-- set of session ids pulled from the bookings in front of us.
create index if not exists lead_video_views_session_idx
  on public.lead_video_views (vp_session_id);

-- The reporting read is "who engaged this week".
create index if not exists lead_video_views_last_seen_idx
  on public.lead_video_views (last_seen_at desc);

alter table public.lead_video_views enable row level security;

comment on table public.lead_video_views is
  'Furthest point reached in each Vidalytics video, one row per first-party session per video. Written by POST /api/attribution/events from the player API; read by /admin/bookings and the pre-call Close note. Service-role only.';
