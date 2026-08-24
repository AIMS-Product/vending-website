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
  contactPreferenceFieldId?: string;
  latestCompletedAtFieldId?: string;
  entrySourceFieldId?: string;
  resourceTagFieldId?: string;
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
  emails?: CloseContactEmail[];
  phones?: CloseContactPhone[];
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

/**
 * A note read back from Close's `/activity/note/` list endpoint. Both `note`
 * and `note_html` come back populated (Close derives one from the other), so
 * either is fine to scan for a marker.
 */
export type CloseNoteResult = {
  id: string;
  note?: string | null;
  note_html?: string | null;
};

// Shapes confirmed against a real GET /contact/{id}/ on the production org.
// Phones also carry derived `country` and `phone_formatted`, which are read-only
// and deliberately not modelled — sync.ts strips them before any write.
type CloseContactEmail = {
  email?: string | null;
  type?: string;
  is_unsubscribed?: boolean;
};
type CloseContactPhone = { phone?: string | null; type?: string };

type CloseContactResult = {
  id: string;
  lead_id?: string | null;
  emails?: CloseContactEmail[];
  phones?: CloseContactPhone[];
};

type CloseLeadResult = {
  id: string;
  contact_ids?: string[];
  contacts?: Array<{ id?: string | null }>;
};

type CloseLeadSearchResult = {
  id: string;
  contacts?: Array<{
    id?: string | null;
    emails?: Array<{ email?: string | null }>;
  }>;
};
/**
 * A lead read back from Close. `custom` is keyed by field NAME (not field ID)
 * when the request asks for the `custom` field group, which is what the booking
 * reconciler reads — it wants "First Call Booked Date" and does not hold that
 * field's ID in config.
 */
export type CloseLeadReadResult = {
  id: string;
  status_label?: string | null;
  custom?: Record<string, unknown> | null;
};

export type CloseCustomFieldDefinition = {
  id: string;
  name: string;
  /** "text", "choices", "date", … — only "choices" carries a `choices` list. */
  type: string;
  choices?: string[] | null;
};

/** Close's search query language treats `"` as a delimiter, so neutralize it. */
function escapeCloseQuery(value: string) {
  return value.replace(/"/g, "");
}

/**
 * Flatten a lead-search response down to the contacts that actually carry the
 * searched address. Close's search is fuzzy across the lead, so a hit does not
 * mean the contact's email matches — compare it explicitly.
 */
function contactsMatchingEmail(
  leads: CloseLeadSearchResult[],
  email: string,
): CloseContactResult[] {
  const target = email.trim().toLowerCase();

  return leads.flatMap((lead) =>
    (lead.contacts ?? [])
      .filter(
        (contact): contact is { id: string; emails?: CloseContactEmail[] } =>
          Boolean(contact.id) &&
          (contact.emails ?? []).some(
            (entry) => entry.email?.trim().toLowerCase() === target,
          ),
      )
      .map((contact) => ({
        id: contact.id,
        lead_id: lead.id,
        emails: contact.emails,
      })),
  );
}

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
      contactPreferenceFieldId: trimmed(env.CLOSE_CONTACT_PREFERENCE_FIELD_ID),
      latestCompletedAtFieldId: trimmed(env.CLOSE_LATEST_COMPLETED_AT_FIELD_ID),
      entrySourceFieldId: trimmed(env.CLOSE_ENTRY_SOURCE_FIELD_ID),
      resourceTagFieldId: trimmed(env.CLOSE_RESOURCE_TAG_FIELD_ID),
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
    async searchContactsByEmail(email: string) {
      // Close's /contact/ endpoint has no `email` filter — it silently ignores
      // unknown query params and returns the org's first page of contacts. That
      // made every lookup return 10 unrelated contacts, so the duplicate guard
      // in sync.ts parked every single lead ("Multiple Close contacts matched").
      // Lead search does support the query language, so search there and keep
      // only the contacts whose email matches exactly.
      const query = encodeURIComponent(`email:"${escapeCloseQuery(email)}"`);
      const result = await request<{ data?: CloseLeadSearchResult[] }>(
        "GET",
        `/lead/?query=${query}&_limit=10`,
      );
      return { data: contactsMatchingEmail(result.data ?? [], email) };
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
    /**
     * Read one lead's status and custom fields. Returns `null` on 404 rather
     * than throwing: leads get merged and deleted in Close all the time, and a
     * lead we synced months ago going missing is normal bookkeeping, not an
     * error the reconciler should retry forever.
     */
    async getLead(leadId: string): Promise<CloseLeadReadResult | null> {
      try {
        return await request<CloseLeadReadResult>(
          "GET",
          `/lead/${encodeURIComponent(leadId)}/?_fields=id,status_label,custom`,
        );
      } catch (error) {
        if (error instanceof CloseApiError && error.status === 404) return null;
        throw error;
      }
    },
    getContact(contactId: string) {
      return request<CloseContactResult>(
        "GET",
        `/contact/${encodeURIComponent(contactId)}/`,
      );
    },
    updateContact(contactId: string, payload: CloseContactPayload) {
      return request<CloseContactResult>(
        "PUT",
        `/contact/${encodeURIComponent(contactId)}/`,
        payload,
      );
    },
    /**
     * The org's custom field definitions for one object type.
     *
     * Read-only, and used by the attribution overview to answer "does this
     * field ID still exist, is it scoped to the object we write it to, and is
     * the literal we send a valid choice on it". Close silently accepts a
     * write to a stale field ID on the wrong object with a 400 rather than a
     * useful message, so the check has to compare against the real schema.
     */
    listCustomFields(scope: "lead" | "contact") {
      return request<{ data?: CloseCustomFieldDefinition[] }>(
        "GET",
        `/custom_field/${scope}/?_limit=200`,
      );
    },
    createNote(payload: CloseNotePayload) {
      return request<{ id: string }>("POST", "/activity/note/", payload);
    },
    /**
     * The lead's existing notes, newest first. Close's note-create endpoint
     * has no idempotency key or dedupe parameter (checked against
     * developer.close.com), so a caller that must not double-post a note for
     * the same event (a redelivered webhook, a reconciliation sweep) has to
     * list first and check for its own marker before creating one.
     */
    listLeadNotes(leadId: string) {
      return request<{ data?: CloseNoteResult[] }>(
        "GET",
        `/activity/note/?lead_id=${encodeURIComponent(leadId)}&_limit=50`,
      );
    },
    createTask(payload: CloseTaskPayload) {
      return request<{ id: string }>("POST", "/task/", payload);
    },
  };
}

export type CloseClient = ReturnType<typeof createCloseClient>;

/**
 * The half of attribution that lives on the CONTACT in Close: the UTMs
 * (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) and the
 * submitting page (`source_path`, Close field "Application Source").
 *
 * Custom fields in Close are scope-locked: sending a contact-scoped field ID on
 * a lead update makes Close reject the entire update with a 400, so these are
 * written with `updateContact` and never mixed into the lead payload. Everything
 * else about the visit (landing path, click IDs, campaign/ad IDs) stays
 * lead-scoped in `closeCustomFieldPayload`.
 */
export function closeContactAttributionPayload(
  values: Record<string, unknown>,
  fields: CloseCustomFieldConfig,
) {
  const payload: Record<`custom.${string}`, unknown> = {};
  assignCustom(payload, fields.sourcePathFieldId, values.source_path);
  assignCustom(payload, fields.utmSourceFieldId, values.utm_source);
  assignCustom(payload, fields.utmMediumFieldId, values.utm_medium);
  assignCustom(payload, fields.utmCampaignFieldId, values.utm_campaign);
  assignCustom(payload, fields.utmTermFieldId, values.utm_term);
  assignCustom(payload, fields.utmContentFieldId, values.utm_content);
  return payload;
}

/**
 * Stephen's lead-scoped tagging fields, written on lead CREATE only.
 *
 * Entry Source / Recapture State / Ever Had Call are `choices` fields in Close —
 * Close 400s a value that is not an exact choice label, so the callers must only
 * ever pass values from CLOSE_ENTRY_SOURCE_CHOICES et al. Resource Tag is free
 * text.
 *
 * These are never sent on update: Entry Source and Resource Tag are first-touch
 * attribution, and Close's own workflows own Recapture State and Ever Had Call
 * after creation. Re-sending them would stomp rep and automation edits.
 */
/**
 * The exact choice labels configured on Stephen's Close fields.
 *
 * Close validates `choices` fields against its own list and rejects anything
 * else, so these are literals rather than anything derived — and the
 * attribution overview checks each one still exists on the live field.
 */
export const CLOSE_TAGGING_VALUES = {
  entrySourceLeadMagnet: "Lead-Magnet",
  entrySourceWebsiteApply: "Website-Apply",
} as const;

/**
 * Resource Tag values, one per magnet.
 *
 * `roadmap` deliberately reuses the sales team's existing `lead-magnet-90-days`
 * rather than a name of our own: that tag is already in use in Close for the
 * 90-day roadmap, and a second name for the same magnet would split it across
 * two buckets in their reporting. The other two have no existing equivalent, so
 * they are new names — Kody may rename them, which is a one-line change here.
 */
export const CLOSE_RESOURCE_TAGS = {
  roadmap: "lead-magnet-90-days",
  financeTemplates: "lead-magnet-finance-templates",
  newsletter: "newsletter",
  websiteApplication: "website-application",
  // Site chatbot leads (see close/sync.ts taggingValues). No "chatbot" choice
  // exists on Close's Entry Source field, so this is the only place that
  // signal is written — Entry Source stays unset for these leads.
  chatbot: "chatbot",
} as const;

/**
 * The two lead-scoped tagging fields this site owns, written on CREATE only.
 *
 * Deliberately only two. Recapture State and Ever Had Call are set by the
 * reconciler in Close's Lane 2 automation (Stephen, 2026-08-06). Writing them
 * from here is at best redundant, and at worst changes which leads that
 * automation picks up — so we stay out of them entirely.
 *
 * Never sent on update either: both are first-touch attribution, and
 * re-sending them would stomp rep and automation edits.
 */
export function closeTaggingPayload(
  values: Record<string, unknown>,
  fields: CloseCustomFieldConfig,
) {
  const payload: Record<`custom.${string}`, unknown> = {};
  assignCustom(payload, fields.entrySourceFieldId, values.entry_source);
  assignCustom(payload, fields.resourceTagFieldId, values.resource_tag);
  return payload;
}

export function closeCustomFieldPayload(
  values: Record<string, unknown>,
  fields: CloseCustomFieldConfig,
) {
  const payload: Record<`custom.${string}`, unknown> = {};
  assignCustom(payload, fields.qualificationStatusFieldId, values.status);
  assignCustom(payload, fields.vpSessionIdFieldId, values.vp_session_id);
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
  // UTMs and source_path are deliberately absent here — they are contact-scoped in
  // Close and are built by closeContactAttributionPayload instead. See that function.
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
  assignCustom(
    payload,
    fields.contactPreferenceFieldId,
    values.contact_preference,
  );
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
