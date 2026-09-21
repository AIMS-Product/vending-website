-- Make "furthest point reached" actually monotonic.
--
-- The first version read the current row, compared in JS, then wrote. Two
-- beacons that land together both read the old value and the loser's number
-- wins. That was written off as a rare same-session collision; it is not. A
-- visitor who drags the scrubber crosses several quarters at once and the
-- client sends them in the same instant, so the race is the normal path, not
-- the edge. Measured on the live page 2026-09-21: seeking to 60% stored 25.
--
-- Postgres can express "only ever increase" in one statement, and PostgREST
-- cannot reach an ON CONFLICT expression — so it lives here, as a function the
-- service calls. This is also less application code than the read-then-write
-- it replaces, and it removes the read entirely.

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
