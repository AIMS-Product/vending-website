-- The YouTube tab's clicks window probe reads the earliest synced day:
--   select day from bitly_link_clicks order by day limit 1
--
-- Neither existing index serves it. The primary key is (bitly_id, day), so an
-- ordering on `day` alone cannot use it, and bitly_link_clicks_campaign_day_idx
-- is partial on `utm_campaign is not null`, so it cannot answer for the whole
-- table. Without this the probe is still correct, just a sequential scan and
-- sort on every render, against a table that grows one row per link per day.
--
-- A performance fix, not a prerequisite. Applied by hand; safe to run twice.
create index if not exists bitly_link_clicks_day_idx
  on public.bitly_link_clicks (day);
