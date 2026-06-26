export type LeadAttribution = {
  vp_session_id: string;
  source_path: string;
  landing_path: string;
  referrer: string;
  first_landing_url: string;
  first_landing_path: string;
  first_referrer: string;
  first_touch_at: string;
  latest_landing_url: string;
  latest_landing_path: string;
  latest_referrer: string;
  latest_touch_at: string;
  source_page_id: string;
  source_page_slug: string;
  target_keyword: string;
  source_block_id: string;
  source_cta_tracking_name: string;
  clicked_href: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  fbclid: string;
  gbraid: string;
  wbraid: string;
  paid_platform: string;
  paid_source_key: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_group_id: string;
  ad_group_name: string;
  group_id: string;
  group_name: string;
  ad_id: string;
  ad_name: string;
};

export type LeadSearchParams = Record<string, string | string[] | undefined>;

const PARAM_ALIASES = {
  vp_session_id: ["vp_session_id", "vpSessionId", "vp_sid"],
  source_path: ["source_path", "source"],
  referrer: ["referrer"],
  first_landing_url: ["first_landing_url"],
  first_landing_path: ["first_landing_path"],
  first_referrer: ["first_referrer"],
  first_touch_at: ["first_touch_at"],
  latest_landing_url: ["latest_landing_url"],
  latest_landing_path: ["latest_landing_path"],
  latest_referrer: ["latest_referrer"],
  latest_touch_at: ["latest_touch_at"],
  source_page_id: ["source_page_id"],
  source_page_slug: ["source_page_slug"],
  target_keyword: ["target_keyword"],
  source_block_id: ["source_block_id"],
  source_cta_tracking_name: ["source_cta_tracking_name"],
  clicked_href: ["clicked_href"],
  utm_source: ["utm_source"],
  utm_medium: ["utm_medium"],
  utm_campaign: ["utm_campaign"],
  utm_term: ["utm_term"],
  utm_content: ["utm_content"],
  gclid: ["gclid"],
  fbclid: ["fbclid"],
  gbraid: ["gbraid"],
  wbraid: ["wbraid"],
  paid_platform: ["paid_platform", "paidPlatform"],
  paid_source_key: ["paid_source_key", "paidSourceKey", "source_key"],
  campaign_id: [
    "campaign_id",
    "campaignId",
    "utm_campaign_id",
    "google_campaign_id",
    "meta_campaign_id",
  ],
  campaign_name: ["campaign_name", "campaignName", "campaign"],
  adset_id: ["adset_id", "adSetId", "utm_adset_id", "meta_adset_id"],
  adset_name: ["adset_name", "adSetName"],
  ad_group_id: [
    "ad_group_id",
    "adGroupId",
    "utm_ad_group_id",
    "google_ad_group_id",
  ],
  ad_group_name: ["ad_group_name", "adGroupName"],
  group_id: ["group_id", "groupId"],
  group_name: ["group_name", "groupName"],
  ad_id: ["ad_id", "adId", "utm_ad_id", "meta_ad_id", "google_ad_id"],
  ad_name: ["ad_name", "adName", "ad"],
} satisfies Record<Exclude<keyof LeadAttribution, "landing_path">, string[]>;

export function buildLeadAttribution(
  searchParams: LeadSearchParams,
  landingPath: string,
): LeadAttribution {
  return {
    vp_session_id: param(searchParams, PARAM_ALIASES.vp_session_id),
    source_path: param(searchParams, PARAM_ALIASES.source_path) || landingPath,
    landing_path: landingPath,
    referrer: param(searchParams, PARAM_ALIASES.referrer),
    first_landing_url: param(searchParams, PARAM_ALIASES.first_landing_url),
    first_landing_path: param(searchParams, PARAM_ALIASES.first_landing_path),
    first_referrer: param(searchParams, PARAM_ALIASES.first_referrer),
    first_touch_at: param(searchParams, PARAM_ALIASES.first_touch_at),
    latest_landing_url: param(searchParams, PARAM_ALIASES.latest_landing_url),
    latest_landing_path: param(searchParams, PARAM_ALIASES.latest_landing_path),
    latest_referrer: param(searchParams, PARAM_ALIASES.latest_referrer),
    latest_touch_at: param(searchParams, PARAM_ALIASES.latest_touch_at),
    source_page_id: param(searchParams, PARAM_ALIASES.source_page_id),
    source_page_slug: param(searchParams, PARAM_ALIASES.source_page_slug),
    target_keyword: param(searchParams, PARAM_ALIASES.target_keyword),
    source_block_id: param(searchParams, PARAM_ALIASES.source_block_id),
    source_cta_tracking_name: param(
      searchParams,
      PARAM_ALIASES.source_cta_tracking_name,
    ),
    clicked_href: param(searchParams, PARAM_ALIASES.clicked_href),
    utm_source: param(searchParams, PARAM_ALIASES.utm_source),
    utm_medium: param(searchParams, PARAM_ALIASES.utm_medium),
    utm_campaign: param(searchParams, PARAM_ALIASES.utm_campaign),
    utm_term: param(searchParams, PARAM_ALIASES.utm_term),
    utm_content: param(searchParams, PARAM_ALIASES.utm_content),
    gclid: param(searchParams, PARAM_ALIASES.gclid),
    fbclid: param(searchParams, PARAM_ALIASES.fbclid),
    gbraid: param(searchParams, PARAM_ALIASES.gbraid),
    wbraid: param(searchParams, PARAM_ALIASES.wbraid),
    paid_platform: param(searchParams, PARAM_ALIASES.paid_platform),
    paid_source_key: param(searchParams, PARAM_ALIASES.paid_source_key),
    campaign_id: param(searchParams, PARAM_ALIASES.campaign_id),
    campaign_name: param(searchParams, PARAM_ALIASES.campaign_name),
    adset_id: param(searchParams, PARAM_ALIASES.adset_id),
    adset_name: param(searchParams, PARAM_ALIASES.adset_name),
    ad_group_id: param(searchParams, PARAM_ALIASES.ad_group_id),
    ad_group_name: param(searchParams, PARAM_ALIASES.ad_group_name),
    group_id: param(searchParams, PARAM_ALIASES.group_id),
    group_name: param(searchParams, PARAM_ALIASES.group_name),
    ad_id: param(searchParams, PARAM_ALIASES.ad_id),
    ad_name: param(searchParams, PARAM_ALIASES.ad_name),
  };
}

export function emptyLeadAttribution(landingPath: string): LeadAttribution {
  return {
    vp_session_id: "",
    source_path: landingPath,
    landing_path: landingPath,
    referrer: "",
    first_landing_url: "",
    first_landing_path: "",
    first_referrer: "",
    first_touch_at: "",
    latest_landing_url: "",
    latest_landing_path: "",
    latest_referrer: "",
    latest_touch_at: "",
    source_page_id: "",
    source_page_slug: "",
    target_keyword: "",
    source_block_id: "",
    source_cta_tracking_name: "",
    clicked_href: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    gclid: "",
    fbclid: "",
    gbraid: "",
    wbraid: "",
    paid_platform: "",
    paid_source_key: "",
    campaign_id: "",
    campaign_name: "",
    adset_id: "",
    adset_name: "",
    ad_group_id: "",
    ad_group_name: "",
    group_id: "",
    group_name: "",
    ad_id: "",
    ad_name: "",
  };
}

function param(searchParams: LeadSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = firstParam(searchParams[key]);
    if (value) return value;
  }
  return "";
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || undefined;
  return value || undefined;
}
