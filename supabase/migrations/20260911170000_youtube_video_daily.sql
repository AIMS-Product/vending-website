-- YouTube Analytics per video per day.
--
-- GET https://youtubeanalytics.googleapis.com/v2/reports as the channel owner
-- (OAuth, yt-analytics.readonly), one request per day with dimensions=video.
-- channel_daily takes impressions (thumbnail impressions) and clicks (card
-- clicks) under source youtube / content = video id; this table keeps views
-- and the card numbers, which have no column on the spine. NULL means the API
-- did not return that metric, never zero.
--
-- Security model: service-role only (RLS enabled, no policies).
create table if not exists public.youtube_video_daily (
  video_id          text not null,
  day               date not null,
  views             integer check (views is null or views >= 0),
  impressions       integer check (impressions is null or impressions >= 0),
  card_impressions  integer check (card_impressions is null or card_impressions >= 0),
  card_clicks       integer check (card_clicks is null or card_clicks >= 0),
  synced_at         timestamptz not null default now(),
  primary key (video_id, day)
);

create index if not exists youtube_video_daily_day_idx
  on public.youtube_video_daily (day desc);

alter table public.youtube_video_daily enable row level security;

comment on table public.youtube_video_daily is
  'YouTube Analytics API views, thumbnail impressions and card clicks per video per day. Service-role only.';
