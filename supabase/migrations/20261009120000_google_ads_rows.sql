-- Google Ads reporting rows, pushed nightly by the Google Ads Script in
-- scripts/google-ads/sync.js through /api/admin/google-ads-ingest.
-- One table for every report; the script builds a stable row_key per report
-- (date + entity ids) so a rerun upserts instead of duplicating.
create table if not exists public.google_ads_rows (
  report     text not null
    check (report in ('campaign', 'ad', 'asset', 'search_term', 'keyword', 'conversion_action')),
  row_key    text not null,
  day        date,
  data       jsonb not null,
  synced_at  timestamptz not null default now(),
  primary key (report, row_key)
);

create index if not exists google_ads_rows_report_day_idx
  on public.google_ads_rows (report, day);

alter table public.google_ads_rows enable row level security;

drop policy if exists google_ads_rows_admin_read on public.google_ads_rows;
create policy google_ads_rows_admin_read
  on public.google_ads_rows
  for select
  to authenticated
  using (public.is_app_admin());

-- Typed views, one per report. Money is micros in the raw row; dollars here.
create or replace view public.google_ads_campaign_daily
with (security_invoker = true) as
select
  day,
  data->>'campaignId'                          as campaign_id,
  data->>'campaignName'                        as campaign_name,
  data->>'status'                              as status,
  data->>'channel'                             as channel,
  data->>'bidding'                             as bidding,
  (data->>'budgetMicros')::numeric / 1e6       as daily_budget,
  (data->>'impressions')::bigint               as impressions,
  (data->>'clicks')::bigint                    as clicks,
  (data->>'costMicros')::numeric / 1e6         as cost,
  (data->>'conversions')::numeric              as conversions,
  (data->>'conversionsValue')::numeric         as conversions_value,
  (data->>'allConversions')::numeric           as all_conversions
from public.google_ads_rows
where report = 'campaign';

create or replace view public.google_ads_ad_daily
with (security_invoker = true) as
select
  day,
  data->>'campaignId'                  as campaign_id,
  data->>'adGroupId'                   as ad_group_id,
  data->>'adGroupName'                 as ad_group_name,
  data->>'adId'                        as ad_id,
  data->>'adType'                      as ad_type,
  data->>'status'                      as status,
  data->>'adStrength'                  as ad_strength,
  data->>'approval'                    as approval_status,
  data->'finalUrls'                    as final_urls,
  data->'headlines'                    as headlines,
  data->'descriptions'                 as descriptions,
  (data->>'impressions')::bigint       as impressions,
  (data->>'clicks')::bigint            as clicks,
  (data->>'costMicros')::numeric / 1e6 as cost,
  (data->>'conversions')::numeric      as conversions
from public.google_ads_rows
where report = 'ad';

-- Creatives: one row per asset per ad over the sync window, with a preview URL
-- (image URL or YouTube thumbnail) and spend, CTR, CPA next to it.
create or replace view public.google_ads_creatives
with (security_invoker = true) as
select
  data->>'adId'                         as ad_id,
  data->>'assetId'                      as asset_id,
  data->>'assetType'                    as asset_type,
  data->>'fieldType'                    as field_type,
  data->>'performanceLabel'             as performance_label,
  data->>'text'                         as text,
  coalesce(
    data->>'imageUrl',
    case when data->>'youtubeId' is not null
      then 'https://i.ytimg.com/vi/' || (data->>'youtubeId') || '/hqdefault.jpg' end
  )                                     as preview_url,
  sum((data->>'impressions')::bigint)   as impressions,
  sum((data->>'clicks')::bigint)        as clicks,
  sum((data->>'costMicros')::numeric) / 1e6 as cost,
  sum((data->>'conversions')::numeric)  as conversions,
  case when sum((data->>'impressions')::bigint) > 0
    then sum((data->>'clicks')::bigint)::numeric / sum((data->>'impressions')::bigint) end as ctr,
  case when sum((data->>'conversions')::numeric) > 0
    then sum((data->>'costMicros')::numeric) / 1e6 / sum((data->>'conversions')::numeric) end as cpa
from public.google_ads_rows
where report = 'asset'
group by 1, 2, 3, 4, 5, 6, 7;

create or replace view public.google_ads_search_term_daily
with (security_invoker = true) as
select
  day,
  data->>'searchTerm'                  as search_term,
  data->>'status'                      as status,
  data->>'campaignId'                  as campaign_id,
  data->>'adGroupId'                   as ad_group_id,
  (data->>'impressions')::bigint       as impressions,
  (data->>'clicks')::bigint            as clicks,
  (data->>'costMicros')::numeric / 1e6 as cost,
  (data->>'conversions')::numeric      as conversions
from public.google_ads_rows
where report = 'search_term';

create or replace view public.google_ads_keyword_daily
with (security_invoker = true) as
select
  day,
  data->>'keyword'                     as keyword,
  data->>'matchType'                   as match_type,
  (data->>'qualityScore')::int         as quality_score,
  data->>'campaignId'                  as campaign_id,
  data->>'adGroupId'                   as ad_group_id,
  (data->>'impressions')::bigint       as impressions,
  (data->>'clicks')::bigint            as clicks,
  (data->>'costMicros')::numeric / 1e6 as cost,
  (data->>'conversions')::numeric      as conversions
from public.google_ads_rows
where report = 'keyword';

create or replace view public.google_ads_conversion_actions
with (security_invoker = true) as
select
  data->>'id'          as id,
  data->>'name'        as name,
  data->>'type'        as type,
  data->>'status'      as status,
  data->>'category'    as category,
  (data->>'primaryForGoal')::boolean as primary_for_goal,
  data->>'countingType' as counting_type,
  synced_at
from public.google_ads_rows
where report = 'conversion_action';
