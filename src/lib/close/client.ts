import "server-only";

export type CloseCustomFieldConfig = {
  qualificationStatusFieldId?: string;
  vpSessionIdFieldId?: string;
  sourcePathFieldId?: string;
  landingPathFieldId?: string;
  firstLandingUrlFieldId?: string;
  firstLandingPathFieldId?: string;
  firstReferrerFieldId?: string;
  latestLandingUrlFieldId?: string;
  latestLandingPathFieldId?: string;
  latestReferrerFieldId?: string;
  sourcePageIdFieldId?: string;
  sourcePageSlugFieldId?: string;
  targetKeywordFieldId?: string;
  sourceBlockIdFieldId?: string;
  sourceCtaTrackingNameFieldId?: string;
  clickedHrefFieldId?: string;
  utmSourceFieldId?: string;
  utmMediumFieldId?: string;
  utmCampaignFieldId?: string;
  utmTermFieldId?: string;
  utmContentFieldId?: string;
  gclidFieldId?: string;
  fbclidFieldId?: string;
  gbraidFieldId?: string;
  wbraidFieldId?: string;
  paidPlatformFieldId?: string;
  paidSourceKeyFieldId?: string;
  campaignIdFieldId?: string;
  campaignNameFieldId?: string;
  adsetIdFieldId?: string;
  adsetNameFieldId?: string;
  adGroupIdFieldId?: string;
  adGroupNameFieldId?: string;
  groupIdFieldId?: string;
  groupNameFieldId?: string;
  adIdFieldId?: string;
  adNameFieldId?: string;
  experimentKeyFieldId?: string;
  variantKeyFieldId?: string;
  scoreFieldId?: string;
  bandFieldId?: string;
  stateMarketFieldId?: string;
  businessStageFieldId?: string;
  budgetRangeFieldId?: string;
  availableCapitalFieldId?: string;
  purchaseTimelineFieldId?: string;
  locationStatusFieldId?: string;
  machineGoalFieldId?: string;
  primaryGoalFieldId?: string;
  consentStatusFieldId?: string;
  latestCompletedAtFieldId?: string;
};

export type CloseConfig = {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  leadStatusId?: string;
  followUpAssignedTo?: string;
  customFields: CloseCustomFieldConfig;
};

export type CloseContactPayload = {
  name?: string;
  emails?: Array<{ email: string; type?: string }>;
  phones?: Array<{ phone: string; type?: string }>;
};

type CloseLeadPayload = {
  name: string;
  description?: string;
  status_id?: string;
  contacts?: CloseContactPayload[];
  [customField: `custom.${string}`]: unknown;
};

type CloseTaskPayload = {
  _type: "lead";
  lead_id: string;
  text: string;
  date: string;
  assigned_to?: string;
  is_complete?: boolean;
};

type CloseNotePayload = {
  lead_id: string;
  contact_id?: string | null;
  note_html: string;
};

type CloseContactResult = {
  id: string;
  lead_id?: string | null;
  emails?: Array<{ email?: string | null }>;
};

type CloseLeadResult = {
  id: string;
  contact_ids?: string[];
  contacts?: Array<{ id?: string | null }>;
};

export class CloseApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CloseApiError";
    this.status = status;
  }
}

export class CloseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloseConfigError";
  }
}

type CloseEnv = Partial<Record<string, string | undefined>>;

export function closeConfigFromEnv(env: CloseEnv): CloseConfig {
  const apiKey = trimmed(env.CLOSE_API_KEY);
  return {
    enabled: Boolean(apiKey),
    apiKey,
    baseUrl: trimmed(env.CLOSE_API_BASE_URL) ?? "https://api.close.com/api/v1",
    leadStatusId: trimmed(env.CLOSE_LEAD_STATUS_ID),
    followUpAssignedTo: trimmed(env.CLOSE_FOLLOW_UP_ASSIGNED_TO),
    customFields: {
      qualificationStatusFieldId: trimmed(
        env.CLOSE_QUALIFICATION_STATUS_FIELD_ID,
      ),
      vpSessionIdFieldId: trimmed(env.CLOSE_VP_SESSION_ID_FIELD_ID),
      sourcePathFieldId: trimmed(env.CLOSE_SOURCE_PATH_FIELD_ID),
      landingPathFieldId: trimmed(env.CLOSE_LANDING_PATH_FIELD_ID),
      firstLandingUrlFieldId: trimmed(env.CLOSE_FIRST_LANDING_URL_FIELD_ID),
      firstLandingPathFieldId: trimmed(env.CLOSE_FIRST_LANDING_PATH_FIELD_ID),
      firstReferrerFieldId: trimmed(env.CLOSE_FIRST_REFERRER_FIELD_ID),
      latestLandingUrlFieldId: trimmed(env.CLOSE_LATEST_LANDING_URL_FIELD_ID),
      latestLandingPathFieldId: trimmed(env.CLOSE_LATEST_LANDING_PATH_FIELD_ID),
      latestReferrerFieldId: trimmed(env.CLOSE_LATEST_REFERRER_FIELD_ID),
      sourcePageIdFieldId: trimmed(env.CLOSE_SOURCE_PAGE_ID_FIELD_ID),
      sourcePageSlugFieldId: trimmed(env.CLOSE_SOURCE_PAGE_SLUG_FIELD_ID),
      targetKeywordFieldId: trimmed(env.CLOSE_TARGET_KEYWORD_FIELD_ID),
      sourceBlockIdFieldId: trimmed(env.CLOSE_SOURCE_BLOCK_ID_FIELD_ID),
      sourceCtaTrackingNameFieldId: trimmed(
        env.CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID,
      ),
      clickedHrefFieldId: trimmed(env.CLOSE_CLICKED_HREF_FIELD_ID),
      utmSourceFieldId: trimmed(env.CLOSE_UTM_SOURCE_FIELD_ID),
      utmMediumFieldId: trimmed(env.CLOSE_UTM_MEDIUM_FIELD_ID),
      utmCampaignFieldId: trimmed(env.CLOSE_UTM_CAMPAIGN_FIELD_ID),
      utmTermFieldId: trimmed(env.CLOSE_UTM_TERM_FIELD_ID),
      utmContentFieldId: trimmed(env.CLOSE_UTM_CONTENT_FIELD_ID),
      gclidFieldId: trimmed(env.CLOSE_GCLID_FIELD_ID),
      fbclidFieldId: trimmed(env.CLOSE_FBCLID_FIELD_ID),
      gbraidFieldId: trimmed(env.CLOSE_GBRAID_FIELD_ID),
      wbraidFieldId: trimmed(env.CLOSE_WBRAID_FIELD_ID),
      paidPlatformFieldId: trimmed(env.CLOSE_PAID_PLATFORM_FIELD_ID),
      paidSourceKeyFieldId: trimmed(env.CLOSE_PAID_SOURCE_KEY_FIELD_ID),
      campaignIdFieldId: trimmed(env.CLOSE_CAMPAIGN_ID_FIELD_ID),
      campaignNameFieldId: trimmed(env.CLOSE_CAMPAIGN_NAME_FIELD_ID),
      adsetIdFieldId: trimmed(env.CLOSE_ADSET_ID_FIELD_ID),
      adsetNameFieldId: trimmed(env.CLOSE_ADSET_NAME_FIELD_ID),
      adGroupIdFieldId: trimmed(env.CLOSE_AD_GROUP_ID_FIELD_ID),
      adGroupNameFieldId: trimmed(env.CLOSE_AD_GROUP_NAME_FIELD_ID),
      groupIdFieldId: trimmed(env.CLOSE_GROUP_ID_FIELD_ID),
      groupNameFieldId: trimmed(env.CLOSE_GROUP_NAME_FIELD_ID),
      adIdFieldId: trimmed(env.CLOSE_AD_ID_FIELD_ID),
      adNameFieldId: trimmed(env.CLOSE_AD_NAME_FIELD_ID),
      experimentKeyFieldId: trimmed(env.CLOSE_EXPERIMENT_KEY_FIELD_ID),
      variantKeyFieldId: trimmed(env.CLOSE_VARIANT_KEY_FIELD_ID),
      scoreFieldId: trimmed(env.CLOSE_SCORE_FIELD_ID),
      bandFieldId: trimmed(env.CLOSE_BAND_FIELD_ID),
      stateMarketFieldId: trimmed(env.CLOSE_STATE_MARKET_FIELD_ID),
      businessStageFieldId: trimmed(env.CLOSE_BUSINESS_STAGE_FIELD_ID),
      budgetRangeFieldId: trimmed(env.CLOSE_BUDGET_RANGE_FIELD_ID),
      availableCapitalFieldId: trimmed(env.CLOSE_AVAILABLE_CAPITAL_FIELD_ID),
      purchaseTimelineFieldId: trimmed(env.CLOSE_PURCHASE_TIMELINE_FIELD_ID),
      locationStatusFieldId: trimmed(env.CLOSE_LOCATION_STATUS_FIELD_ID),
      machineGoalFieldId: trimmed(env.CLOSE_MACHINE_GOAL_FIELD_ID),
      primaryGoalFieldId: trimmed(env.CLOSE_PRIMARY_GOAL_FIELD_ID),
      consentStatusFieldId: trimmed(env.CLOSE_CONSENT_STATUS_FIELD_ID),
      latestCompletedAtFieldId: trimmed(env.CLOSE_LATEST_COMPLETED_AT_FIELD_ID),
    },
  };
}

export function createCloseClient({
  apiKey,
  baseUrl = "https://api.close.com/api/v1",
  fetchImpl = fetch,
}: {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  if (!apiKey) {
    throw new CloseConfigError("Close API key is not configured.");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await safeResponseText(response);
      const safeText = sanitizeCloseErrorText(text, apiKey);
      throw new CloseApiError(
        response.status,
        boundedError(
          `Close API request failed with ${response.status}${safeText ? `: ${safeText}` : ""}`,
        ),
      );
    }

    return (await response.json()) as T;
  }

  return {
    searchContactsByEmail(email: string) {
      const encoded = encodeURIComponent(email);
      return request<{ data: CloseContactResult[] }>(
        "GET",
        `/contact/?email=${encoded}&_limit=10`,
      );
    },
    createLead(payload: CloseLeadPayload) {
      return request<CloseLeadResult>("POST", "/lead/", payload);
    },
    updateLead(leadId: string, payload: Partial<CloseLeadPayload>) {
      return request<CloseLeadResult>(
        "PUT",
        `/lead/${encodeURIComponent(leadId)}/`,
        payload,
      );
    },
    updateContact(contactId: string, payload: CloseContactPayload) {
      return request<CloseContactResult>(
        "PUT",
        `/contact/${encodeURIComponent(contactId)}/`,
        payload,
      );
    },
    createNote(payload: CloseNotePayload) {
      return request<{ id: string }>("POST", "/activity/note/", payload);
    },
    createTask(payload: CloseTaskPayload) {
      return request<{ id: string }>("POST", "/task/", payload);
    },
  };
}

export type CloseClient = ReturnType<typeof createCloseClient>;

export function closeCustomFieldPayload(
  values: Record<string, unknown>,
  fields: CloseCustomFieldConfig,
) {
  const payload: Record<`custom.${string}`, unknown> = {};
  assignCustom(payload, fields.qualificationStatusFieldId, values.status);
  assignCustom(payload, fields.vpSessionIdFieldId, values.vp_session_id);
  assignCustom(payload, fields.sourcePathFieldId, values.source_path);
  assignCustom(payload, fields.landingPathFieldId, values.landing_path);
  assignCustom(
    payload,
    fields.firstLandingUrlFieldId,
    values.first_landing_url,
  );
  assignCustom(
    payload,
    fields.firstLandingPathFieldId,
    values.first_landing_path,
  );
  assignCustom(payload, fields.firstReferrerFieldId, values.first_referrer);
  assignCustom(
    payload,
    fields.latestLandingUrlFieldId,
    values.latest_landing_url,
  );
  assignCustom(
    payload,
    fields.latestLandingPathFieldId,
    values.latest_landing_path,
  );
  assignCustom(payload, fields.latestReferrerFieldId, values.latest_referrer);
  assignCustom(payload, fields.sourcePageIdFieldId, values.source_page_id);
  assignCustom(payload, fields.sourcePageSlugFieldId, values.source_page_slug);
  assignCustom(payload, fields.targetKeywordFieldId, values.target_keyword);
  assignCustom(payload, fields.sourceBlockIdFieldId, values.source_block_id);
  assignCustom(
    payload,
    fields.sourceCtaTrackingNameFieldId,
    values.source_cta_tracking_name,
  );
  assignCustom(payload, fields.clickedHrefFieldId, values.clicked_href);
  assignCustom(payload, fields.utmSourceFieldId, values.utm_source);
  assignCustom(payload, fields.utmMediumFieldId, values.utm_medium);
  assignCustom(payload, fields.utmCampaignFieldId, values.utm_campaign);
  assignCustom(payload, fields.utmTermFieldId, values.utm_term);
  assignCustom(payload, fields.utmContentFieldId, values.utm_content);
  assignCustom(payload, fields.gclidFieldId, values.gclid);
  assignCustom(payload, fields.fbclidFieldId, values.fbclid);
  assignCustom(payload, fields.gbraidFieldId, values.gbraid);
  assignCustom(payload, fields.wbraidFieldId, values.wbraid);
  assignCustom(payload, fields.paidPlatformFieldId, values.paid_platform);
  assignCustom(payload, fields.paidSourceKeyFieldId, values.paid_source_key);
  assignCustom(payload, fields.campaignIdFieldId, values.campaign_id);
  assignCustom(payload, fields.campaignNameFieldId, values.campaign_name);
  assignCustom(payload, fields.adsetIdFieldId, values.adset_id);
  assignCustom(payload, fields.adsetNameFieldId, values.adset_name);
  assignCustom(payload, fields.adGroupIdFieldId, values.ad_group_id);
  assignCustom(payload, fields.adGroupNameFieldId, values.ad_group_name);
  assignCustom(payload, fields.groupIdFieldId, values.group_id);
  assignCustom(payload, fields.groupNameFieldId, values.group_name);
  assignCustom(payload, fields.adIdFieldId, values.ad_id);
  assignCustom(payload, fields.adNameFieldId, values.ad_name);
  assignCustom(payload, fields.experimentKeyFieldId, values.experiment_key);
  assignCustom(payload, fields.variantKeyFieldId, values.variant_key);
  assignCustom(payload, fields.scoreFieldId, values.score);
  assignCustom(payload, fields.bandFieldId, values.band);
  assignCustom(payload, fields.stateMarketFieldId, values.state_market);
  assignCustom(payload, fields.businessStageFieldId, values.business_stage);
  assignCustom(payload, fields.budgetRangeFieldId, values.budget_range);
  assignCustom(
    payload,
    fields.availableCapitalFieldId,
    values.available_capital,
  );
  assignCustom(payload, fields.purchaseTimelineFieldId, values.timeline);
  assignCustom(payload, fields.locationStatusFieldId, values.location_status);
  assignCustom(payload, fields.machineGoalFieldId, values.machine_goal);
  assignCustom(payload, fields.primaryGoalFieldId, values.goal);
  assignCustom(payload, fields.consentStatusFieldId, values.consent);
  assignCustom(payload, fields.latestCompletedAtFieldId, values.completed_at);
  return payload;
}

export function boundedError(value: string) {
  return value.slice(0, 320);
}

export function sanitizeCloseErrorText(value: string, apiKey?: string) {
  let sanitized = value.replace(/\s+/g, " ").trim();
  if (apiKey) sanitized = sanitized.split(apiKey).join("[redacted]");
  return sanitized.slice(0, 240);
}

function assignCustom(
  payload: Record<`custom.${string}`, unknown>,
  fieldId: string | undefined,
  value: unknown,
) {
  if (!fieldId || value == null || value === "") return;
  payload[`custom.${fieldId}`] = value;
}

function trimmed(value: string | undefined) {
  const result = value?.trim();
  return result ? result : undefined;
}

async function safeResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
