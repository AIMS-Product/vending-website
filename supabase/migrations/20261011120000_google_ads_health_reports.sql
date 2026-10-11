-- Google Ads health and attribution reports (scripts/google-ads/sync.js).
-- Adds five report types to google_ads_rows and one view each:
--   campaign_status   serving / primary status and reasons, one row per campaign
--   ad_status         approval and policy topics, one row per ad (not removed)
--   click             gclid -> keyword, ad group, device, region (click_view)
--   conversion_daily  conversions per conversion action per campaign per day
--   search_term_conversion  search terms that produced a form fill or CRM upload
-- Safe to run twice.

alter table public.google_ads_rows
  drop constraint if exists google_ads_rows_report_check;
alter table public.google_ads_rows
  add constraint google_ads_rows_report_check check (report in (
    'campaign', 'ad', 'asset', 'search_term', 'keyword', 'conversion_action',
    'campaign_status', 'ad_status', 'click', 'conversion_daily',
    'search_term_conversion'
  ));

-- Status snapshots: only rows written by the latest run count. A campaign or
-- ad removed since then would otherwise keep its last status forever.
create or replace view public.google_ads_campaign_status
with (security_invoker = true) as
select
  data->>'campaignId'                    as campaign_id,
  data->>'campaignName'                  as campaign_name,
  data->>'status'                        as status,
  data->>'servingStatus'                 as serving_status,
  data->>'primaryStatus'                 as primary_status,
  data->'primaryStatusReasons'           as primary_status_reasons,
  (data->>'budgetMicros')::numeric / 1e6 as daily_budget,
  data->>'bidding'                       as bidding,
  synced_at
from public.google_ads_rows r
where report = 'campaign_status'
  and synced_at > (
    select max(synced_at) - interval '2 hours'
    from public.google_ads_rows where report = 'campaign_status'
  );

create or replace view public.google_ads_ad_status
with (security_invoker = true) as
select
  data->>'campaignId'            as campaign_id,
  data->>'adGroupId'             as ad_group_id,
  data->>'adGroupName'           as ad_group_name,
  data->>'adGroupStatus'         as ad_group_status,
  data->>'adId'                  as ad_id,
  data->>'status'                as status,
  data->>'approval'              as approval_status,
  data->>'review'                as review_status,
  data->'policyTopics'           as policy_topics,
  data->>'primaryStatus'         as primary_status,
  data->'primaryStatusReasons'   as primary_status_reasons,
  synced_at
from public.google_ads_rows
where report = 'ad_status'
  and synced_at > (
    select max(synced_at) - interval '2 hours'
    from public.google_ads_rows where report = 'ad_status'
  );

-- Clicks are kept after they leave the script's window: they are how a lead
-- from before utm_term existed (2026-10-10) gets its keyword back.
create or replace view public.google_ads_clicks
with (security_invoker = true) as
select
  day,
  data->>'gclid'       as gclid,
  data->>'campaignId'  as campaign_id,
  data->>'adGroupId'   as ad_group_id,
  data->>'keyword'     as keyword,
  data->>'matchType'   as match_type,
  data->>'device'      as device,
  data->>'region'      as region
from public.google_ads_rows
where report = 'click';

create or replace view public.google_ads_conversion_daily
with (security_invoker = true) as
select
  day,
  data->>'campaignId'                  as campaign_id,
  data->>'actionId'                    as action_id,
  data->>'actionName'                  as action_name,
  (data->>'conversions')::numeric      as conversions,
  (data->>'allConversions')::numeric   as all_conversions
from public.google_ads_rows
where report = 'conversion_daily';

create or replace view public.google_ads_search_term_conversions
with (security_invoker = true) as
select
  day,
  data->>'searchTerm'                  as search_term,
  data->>'campaignId'                  as campaign_id,
  data->>'adGroupId'                   as ad_group_id,
  data->>'actionName'                  as action_name,
  (data->>'allConversions')::numeric   as all_conversions
from public.google_ads_rows
where report = 'search_term_conversion';
