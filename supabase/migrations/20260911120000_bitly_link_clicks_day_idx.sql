-- The clicks window probe reads the earliest synced day:
--   select day from bitly_link_clicks order by day limit 1
--
-- Neither existing index serves it. The primary key is (bitly_id, day), so an
-- ordering on `day` alone cannot use it, and bitly_link_clicks_campaign_day_idx
-- is partial on `utm_campaign is not null`, so it cannot answer for the whole
-- table. That left a sequential scan plus a sort on every render of the
-- YouTube tab, against a table that grows one row per link per day.
--
-- The probe degrades without this index rather than breaking: it stays correct,
-- just slower, so applying this is a performance fix and not a prerequisite.
create index if not exists bitly_link_clicks_day_idx
  on public.bitly_link_clicks (day);
