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
