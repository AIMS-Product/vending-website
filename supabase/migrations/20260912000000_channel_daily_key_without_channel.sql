-- Re-key the channel spine on the six link dimensions only.
--
-- `channel` is derived from `source` (resolveChannel), so it was never an
-- independent dimension. With it in the primary key, renaming a channel
-- (google -> Organic search, referrer hostnames -> Referral, ltf -> Low ticket
-- funnel) made the next sync write a fresh row under the new label and leave
-- the old row behind; the dashboard then summed both. On 2026-09-11 prod had
-- 2,788 doubled keys: 140 leads, 85 booked, 52 showed and 7,651 visits too
-- many over 30 days.
--
-- 1. Merge duplicates. Per key keep the most recently synced row's channel
--    and, per metric, the most recently synced non-null value (a later GA4
--    run is a revision of an earlier one). Program channels (Webinar) win the
--    label regardless of age: a webinar row's source is the ad platform that
--    filled the room, and the program must not lose it to a visits sync.
-- 2. Drop channel from the key. Every upsert now overwrites channel, so a
--    rename applies to old days on the next backfill instead of forking them.
-- 3. A trigger keeps a program channel once set, for the same reason as (1).

-- One statement: the Supabase SQL editor does not guarantee that a table
-- created by an earlier statement is visible to a later one, so the merge
-- and the key change run together inside a single DO block.
do $$
begin
  create temp table channel_daily_merged on commit drop as
  select
    day, source, medium, campaign, content, destination,
    (array_agg(channel order by (channel = 'Webinar') desc, synced_at desc))[1] as channel,
    (array_agg(spend       order by synced_at desc) filter (where spend       is not null))[1] as spend,
    (array_agg(impressions order by synced_at desc) filter (where impressions is not null))[1] as impressions,
    (array_agg(reach       order by synced_at desc) filter (where reach       is not null))[1] as reach,
    (array_agg(clicks      order by synced_at desc) filter (where clicks      is not null))[1] as clicks,
    (array_agg(visits      order by synced_at desc) filter (where visits      is not null))[1] as visits,
    (array_agg(leads       order by synced_at desc) filter (where leads       is not null))[1] as leads,
    (array_agg(booked      order by synced_at desc) filter (where booked      is not null))[1] as booked,
    (array_agg(showed      order by synced_at desc) filter (where showed      is not null))[1] as showed,
    (array_agg(won         order by synced_at desc) filter (where won         is not null))[1] as won,
    (array_agg(revenue     order by synced_at desc) filter (where revenue     is not null))[1] as revenue,
    max(synced_at) as synced_at
  from public.channel_daily
  group by day, source, medium, campaign, content, destination
  having count(*) > 1;

  delete from public.channel_daily d
  using channel_daily_merged m
  where d.day = m.day
    and d.source = m.source
    and d.medium = m.medium
    and d.campaign = m.campaign
    and d.content = m.content
    and d.destination = m.destination;

  insert into public.channel_daily
    (day, channel, source, medium, campaign, content, destination,
     spend, impressions, reach, clicks, visits, leads, booked, showed, won, revenue, synced_at)
  select
    day, channel, source, medium, campaign, content, destination,
    spend, impressions, reach, clicks, visits, leads, booked, showed, won, revenue, synced_at
  from channel_daily_merged;

  alter table public.channel_daily drop constraint channel_daily_pkey;
  alter table public.channel_daily
    add primary key (day, source, medium, campaign, content, destination);
end
$$;

-- A program channel, once written for a key, is kept when another connector
-- (GA4 visits for the same tagged link) upserts the row. Mirrors
-- PROGRAM_CHANNELS in src/lib/services/channel-report-rollup.ts.
create or replace function public.channel_daily_keep_program_channel()
returns trigger
language plpgsql
as $$
begin
  if old.channel = 'Webinar' and new.channel <> old.channel then
    new.channel := old.channel;
  end if;
  return new;
end;
$$;

drop trigger if exists channel_daily_keep_program_channel on public.channel_daily;
create trigger channel_daily_keep_program_channel
  before update on public.channel_daily
  for each row
  execute function public.channel_daily_keep_program_channel();

comment on table public.channel_daily is
  'Daily channel spine keyed on the link standard (day, source, medium, campaign, content, destination). channel is derived from source and overwritten on every upsert; Webinar rows keep their program label. Additive metrics only; NULL means not observed, never zero. Each connector upserts only the metric columns it can see.';
