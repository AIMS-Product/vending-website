import "server-only";

export type CloseCustomFieldConfig = {
  qualificationStatusFieldId?: string;
  sourcePathFieldId?: string;
  experimentKeyFieldId?: string;
  variantKeyFieldId?: string;
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

export type CloseLeadPayload = {
  name: string;
  description?: string;
  status_id?: string;
  contacts?: CloseContactPayload[];
  [customField: `custom.${string}`]: unknown;
};

export type CloseTaskPayload = {
  _type: "lead";
  lead_id: string;
  text: string;
  date: string;
  assigned_to?: string;
  is_complete?: boolean;
};

export type CloseNotePayload = {
  lead_id: string;
  contact_id?: string | null;
  note_html: string;
};

export type CloseContactResult = {
  id: string;
  lead_id?: string | null;
  emails?: Array<{ email?: string | null }>;
};

export type CloseLeadResult = {
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
      sourcePathFieldId: trimmed(env.CLOSE_SOURCE_PATH_FIELD_ID),
      experimentKeyFieldId: trimmed(env.CLOSE_EXPERIMENT_KEY_FIELD_ID),
      variantKeyFieldId: trimmed(env.CLOSE_VARIANT_KEY_FIELD_ID),
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
  assignCustom(payload, fields.sourcePathFieldId, values.source_path);
  assignCustom(payload, fields.experimentKeyFieldId, values.experiment_key);
  assignCustom(payload, fields.variantKeyFieldId, values.variant_key);
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
