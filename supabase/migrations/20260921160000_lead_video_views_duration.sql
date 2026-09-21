-- The video's full length, so a stored percent can be read back as time.
--
-- Added the same day as the table, before any row existed, because "watched
-- 60% of it" is a weaker thing to tell a rep than "watched three of the five
-- minutes" — and a percent alone can never be turned into the second without
-- knowing how long the video was. Only the player knows that, and marketing
-- swaps videos without telling anyone, so it is captured per event rather than
-- looked up from a list someone has to maintain.
--
-- Nullable: an event that arrived before the player could report a duration is
-- still a real view, and dropping it to keep the column clean would understate
-- engagement.

alter table public.lead_video_views
  add column if not exists duration_seconds integer;

alter table public.lead_video_views
  drop constraint if exists lead_video_views_duration_sane;

-- Eight hours. The write path is a public endpoint, and one absurd length
-- would poison every average built on this column.
alter table public.lead_video_views
  add constraint lead_video_views_duration_sane
    check (duration_seconds is null
           or (duration_seconds > 0 and duration_seconds <= 28800));
