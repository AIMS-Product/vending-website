-- Drop the Google Ads visit rows keyed on the campaign NAME.
--
-- Google Ads auto-tagging reports the campaign name to GA4, but the tracking
-- template on the link writes `utm_campaign=<numeric campaign id>`. So the
-- ga4-visits connector wrote "VP - Search - Brand" while the leads connector
-- wrote "23805931083" for the same ad, the two never met on a spine key, and
-- every paired rate for Google Ads came out null (KPI tab 2026-09-11: 5,254
-- visits, 122 leads, opt-in a dash).
--
-- The connector now keys paid Google rows on the id. The name-keyed rows it
-- wrote before must go, or the next `?days=400` backfill leaves both and
-- Google Ads counts its visits twice.
--
-- Only rows whose ONLY observed metric is visits are deleted: that is exactly
-- the ga4-visits connector's footprint. A paid Google row carrying leads,
-- clicks or spend was written by another connector from a real link and is
-- left alone.
do $$
declare
  removed bigint;
begin
  delete from public.channel_daily
  where source = 'google'
    and medium ~ '^(cpc|ppc|paid|paid[-_ ]?(search|social)|social[-_ ]?paid|display|pmax)$'
    and campaign !~ '^[1-9][0-9]*$'
    and visits is not null
    and spend is null
    and impressions is null
    and reach is null
    and clicks is null
    and leads is null
    and booked is null
    and showed is null
    and won is null
    and revenue is null;

  get diagnostics removed = row_count;
  raise notice 'removed % name-keyed Google Ads visit rows', removed;
end
$$;
