import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  jsonArrayAt as arrayAt,
  jsonNumberAt as numberAt,
  jsonObjectAt as objectAt,
  jsonStringAt as stringAt,
} from "@/lib/json-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";
import {
  boundedError,
  closeConfigFromEnv,
  closeCustomFieldPayload,
  CloseConfigError,
  createCloseClient,
  sanitizeCloseErrorText,
  type CloseClient,
  type CloseConfig,
  type CloseContactPayload,
} from "./client";

type CloseSyncEventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;
type CloseSyncClient = Pick<SupabaseClient<Database>, "from">;
type CloseSyncEventUpdate =
  Database["public"]["Tables"]["close_sync_events"]["Update"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];

export type AdminRunCloseSyncResult = {
  scanned: number;
  synced: number;
  failed: number;
  deadLettered: number;
  needsReview: number;
  skipped: number;
  errors: Array<{ eventId: string; message: string }>;
};

export type AdminRunCloseSyncDeps = {
  client?: CloseSyncClient;
  closeConfig?: CloseConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  maxEvents?: number;
};

type CloseContactInfo = {
  leadId: string;
  contactId: string | null;
};

class CloseNeedsReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloseNeedsReviewError";
  }
}

const EVENT_FIELDS =
  "id,lead_submission_id,session_id,event_type,status,dedupe_key,payload,close_lead_id,close_contact_id,attempt_count,max_attempts,next_retry_at,last_attempted_at,synced_at,last_error,created_at,updated_at" as const;

const LEAD_FIELDS =
  "id,full_name,email,phone,source_path,landing_path,referrer,source_page_id,source_page_slug,target_keyword,source_block_id,source_cta_tracking_name,utm_source,utm_medium,utm_campaign,utm_term,utm_content,close_lead_id,close_contact_id,close_sync_status,close_sync_attempt_count,close_sync_last_error" as const;

const RETRYABLE_STATUSES = new Set(["pending", "failed", "retrying"]);
const LEAD_SOURCE_FIELDS = [
  ["source_path", "source_path"],
  ["landing_path", "landing_path"],
  ["referrer", "referrer"],
  ["source_page_id", "source_page_id"],
  ["source_page_slug", "source_page_slug"],
  ["target_keyword", "target_keyword"],
  ["source_block_id", "source_block_id"],
  ["source_cta_tracking_name", "source_cta_tracking_name"],
  ["utm_source", "utm_source"],
  ["utm_medium", "utm_medium"],
  ["utm_campaign", "utm_campaign"],
  ["utm_term", "utm_term"],
  ["utm_content", "utm_content"],
] as const;
const PAID_ATTRIBUTION_FIELDS = [
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
  "paid_platform",
  "paid_source_key",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_group_id",
  "ad_group_name",
  "group_id",
  "group_name",
  "ad_id",
  "ad_name",
] as const;
const SESSION_ATTRIBUTION_FIELDS = [
  "vp_session_id",
  "first_landing_url",
  "first_landing_path",
  "first_referrer",
  "first_touch_at",
  "latest_landing_url",
  "latest_landing_path",
  "latest_referrer",
  "latest_touch_at",
  "clicked_href",
] as const;

export async function adminRunCloseSync(
  deps: AdminRunCloseSyncDeps = {},
): Promise<AdminRunCloseSyncResult> {
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const client = deps.client ?? createAdminClient();
  const closeConfig = deps.closeConfig ?? closeConfigFromEnv(config);
  const events = await listDueCloseSyncEvents(client, nowIso, deps.maxEvents);
  const result: AdminRunCloseSyncResult = {
    scanned: events.length,
    synced: 0,
    failed: 0,
    deadLettered: 0,
    needsReview: 0,
    skipped: 0,
    errors: [],
  };

  for (const event of events) {
    const processed = await processCloseSyncEvent(event, {
      client,
      closeConfig,
      fetchImpl: deps.fetchImpl,
      now,
    });
    result.synced += processed === "synced" ? 1 : 0;
    result.failed += processed === "failed" ? 1 : 0;
    result.deadLettered += processed === "dead_letter" ? 1 : 0;
    result.needsReview += processed === "needs_review" ? 1 : 0;
    result.skipped += processed === "skipped" ? 1 : 0;
    if (processed !== "synced" && processed !== "skipped") {
      const latest = await getCloseSyncEvent(client, event.id);
      result.errors.push({
        eventId: event.id,
        message: latest?.last_error ?? "Close sync did not complete.",
      });
    }
  }

  return result;
}

async function processCloseSyncEvent(
  event: CloseSyncEventRow,
  {
    client,
    closeConfig,
    fetchImpl,
    now,
  }: {
    client: CloseSyncClient;
    closeConfig: CloseConfig;
    fetchImpl?: typeof fetch;
    now: Date;
  },
): Promise<"synced" | "failed" | "dead_letter" | "needs_review" | "skipped"> {
  if (!RETRYABLE_STATUSES.has(event.status)) return "skipped";

  const nowIso = now.toISOString();
  const attemptCount = event.attempt_count + 1;
  await updateEvent(client, event.id, {
    status: "retrying",
    attempt_count: attemptCount,
    last_attempted_at: nowIso,
    last_error: null,
  });
  if (event.lead_submission_id) {
    await updateLead(client, event.lead_submission_id, {
      close_sync_status: "retrying",
      close_sync_attempt_count: attemptCount,
      close_sync_last_attempted_at: nowIso,
      close_sync_last_error: null,
    });
  }

  try {
    if (!closeConfig.enabled) {
      throw new CloseConfigError("Close API key is not configured.");
    }

    const close = createCloseClient({
      apiKey: closeConfig.apiKey,
      baseUrl: closeConfig.baseUrl,
      fetchImpl,
    });
    const lead = event.lead_submission_id
      ? await getLead(client, event.lead_submission_id)
      : null;
    const syncedIds = await dispatchCloseEvent(event, {
      close,
      closeConfig,
      lead,
    });

    await updateEvent(client, event.id, {
      status: "synced",
      synced_at: nowIso,
      last_error: null,
      close_lead_id: syncedIds.leadId,
      close_contact_id: syncedIds.contactId,
      attempt_count: attemptCount,
    });
    if (event.lead_submission_id) {
      await updateLead(client, event.lead_submission_id, {
        close_sync_status: "synced",
        close_sync_attempt_count: attemptCount,
        close_sync_last_error: null,
        close_sync_synced_at: nowIso,
        close_lead_id: syncedIds.leadId,
        close_contact_id: syncedIds.contactId,
      });
    }
    return "synced";
  } catch (error) {
    if (error instanceof CloseNeedsReviewError) {
      await recordNeedsReview(client, event, {
        attemptCount,
        nowIso,
        message: error.message,
      });
      return "needs_review";
    }

    const message = sanitizeSyncError(error, closeConfig.apiKey);
    const exhausted = attemptCount >= event.max_attempts;
    const status = exhausted ? "dead_letter" : "failed";
    await updateEvent(client, event.id, {
      status,
      attempt_count: attemptCount,
      last_attempted_at: nowIso,
      next_retry_at: nextRetryAt(now, attemptCount).toISOString(),
      last_error: message,
    });
    if (event.lead_submission_id) {
      await updateLead(client, event.lead_submission_id, {
        close_sync_status: status,
        close_sync_attempt_count: attemptCount,
        close_sync_last_attempted_at: nowIso,
        close_sync_next_retry_at: nextRetryAt(now, attemptCount).toISOString(),
        close_sync_last_error: message,
      });
    }
    return status;
  }
}

async function dispatchCloseEvent(
  event: CloseSyncEventRow,
  {
    close,
    closeConfig,
    lead,
  }: {
    close: CloseClient;
    closeConfig: CloseConfig;
    lead: LeadRow | null;
  },
): Promise<CloseContactInfo> {
  if (event.event_type === "lead_create_or_update") {
    return syncLeadCreateOrUpdate(event, { close, closeConfig, lead });
  }
  if (event.event_type === "qualification_enrichment") {
    return syncQualificationEnrichment(event, { close, closeConfig, lead });
  }
  if (event.event_type === "stale_follow_up_task") {
    return syncStaleFollowUpTask(event, { close, closeConfig, lead });
  }
  if (event.event_type === "manual_retry") {
    return syncLeadCreateOrUpdate(event, { close, closeConfig, lead });
  }
  throw new Error(`Unsupported Close sync event type: ${event.event_type}`);
}

async function syncLeadCreateOrUpdate(
  event: CloseSyncEventRow,
  {
    close,
    closeConfig,
    lead,
  }: {
    close: CloseClient;
    closeConfig: CloseConfig;
    lead: LeadRow | null;
  },
): Promise<CloseContactInfo> {
  const contact = contactPayload(event, lead);
  const sourceFields = sourceCustomFields(event, lead, closeConfig);
  const closeIds = existingCloseIds(event, lead);
  if (closeIds.leadId) {
    return updateKnownCloseLead(close, {
      contact,
      contactId: closeIds.contactId,
      leadId: closeIds.leadId,
      sourceFields,
    });
  }

  return syncUnknownCloseLead(close, {
    contact,
    event,
    lead,
    sourceFields,
    closeConfig,
  });
}

function existingCloseIds(event: CloseSyncEventRow, lead: LeadRow | null) {
  return {
    leadId: event.close_lead_id ?? lead?.close_lead_id ?? null,
    contactId: event.close_contact_id ?? lead?.close_contact_id ?? null,
  };
}

async function syncUnknownCloseLead(
  close: CloseClient,
  {
    closeConfig,
    contact,
    event,
    lead,
    sourceFields,
  }: {
    closeConfig: CloseConfig;
    contact: CloseContactPayload;
    event: CloseSyncEventRow;
    lead: LeadRow | null;
    sourceFields: Record<`custom.${string}`, unknown>;
  },
): Promise<CloseContactInfo> {
  const email = primaryEmail(event, lead);
  const match = await matchedContactForEmail(close, email);
  if (match)
    return updateMatchedCloseContact(close, match, contact, sourceFields);

  const created = await close.createLead(
    createLeadPayload({ closeConfig, contact, email, lead, sourceFields }),
  );
  return {
    leadId: created.id,
    contactId: created.contacts?.[0]?.id ?? created.contact_ids?.[0] ?? null,
  };
}

async function matchedContactForEmail(
  close: CloseClient,
  email: string | null,
) {
  return email ? findSingleCloseContact(close, email) : null;
}

function createLeadPayload({
  closeConfig,
  contact,
  email,
  lead,
  sourceFields,
}: {
  closeConfig: CloseConfig;
  contact: CloseContactPayload;
  email: string | null;
  lead: LeadRow | null;
  sourceFields: Record<`custom.${string}`, unknown>;
}) {
  return {
    name: contact.name ?? lead?.full_name ?? email ?? "Website lead",
    ...leadStatusPayload(closeConfig),
    ...sourceFields,
    contacts: [contact],
  };
}

function leadStatusPayload({ leadStatusId }: CloseConfig) {
  return leadStatusId ? { status_id: leadStatusId } : {};
}

async function updateKnownCloseLead(
  close: CloseClient,
  {
    contact,
    contactId,
    leadId,
    sourceFields,
  }: {
    contact: CloseContactPayload;
    contactId?: string | null;
    leadId: string;
    sourceFields: Record<`custom.${string}`, unknown>;
  },
): Promise<CloseContactInfo> {
  if (contactId) await close.updateContact(contactId, contact);
  await updateCloseLeadSourceFields(close, leadId, sourceFields);
  return { leadId, contactId: contactId ?? null };
}

async function findSingleCloseContact(close: CloseClient, email: string) {
  const matches = await close.searchContactsByEmail(email);
  if (matches.data.length > 1) {
    throw new CloseNeedsReviewError(
      `Multiple Close contacts matched ${email}.`,
    );
  }
  return matches.data[0] ?? null;
}

async function updateMatchedCloseContact(
  close: CloseClient,
  match: Awaited<
    ReturnType<CloseClient["searchContactsByEmail"]>
  >["data"][number],
  contact: CloseContactPayload,
  sourceFields: Record<`custom.${string}`, unknown>,
): Promise<CloseContactInfo> {
  if (!match.lead_id) {
    throw new CloseNeedsReviewError(
      `Close contact ${match.id} did not include a parent lead.`,
    );
  }
  await close.updateContact(match.id, contact);
  await updateCloseLeadSourceFields(close, match.lead_id, sourceFields);
  return { leadId: match.lead_id, contactId: match.id };
}

async function updateCloseLeadSourceFields(
  close: CloseClient,
  leadId: string,
  sourceFields: Record<`custom.${string}`, unknown>,
) {
  if (Object.keys(sourceFields).length)
    await close.updateLead(leadId, sourceFields);
}

async function syncQualificationEnrichment(
  event: CloseSyncEventRow,
  {
    close,
    closeConfig,
    lead,
  }: {
    close: CloseClient;
    closeConfig: CloseConfig;
    lead: LeadRow | null;
  },
): Promise<CloseContactInfo> {
  const leadId = event.close_lead_id ?? lead?.close_lead_id;
  if (!leadId) {
    throw new CloseNeedsReviewError(
      "Qualification enrichment is missing a Close lead ID.",
    );
  }
  const contactId = event.close_contact_id ?? lead?.close_contact_id ?? null;
  await close.createNote({
    lead_id: leadId,
    contact_id: contactId,
    note_html: qualificationNoteHtml(event.payload),
  });

  const customFields = qualificationCustomFields(event.payload, closeConfig);
  if (Object.keys(customFields).length) {
    await close.updateLead(leadId, customFields);
  }
  return { leadId, contactId };
}

async function syncStaleFollowUpTask(
  event: CloseSyncEventRow,
  {
    close,
    closeConfig,
    lead,
  }: {
    close: CloseClient;
    closeConfig: CloseConfig;
    lead: LeadRow | null;
  },
): Promise<CloseContactInfo> {
  const leadId = event.close_lead_id ?? lead?.close_lead_id;
  if (!leadId) {
    throw new CloseNeedsReviewError(
      "Stale follow-up task is missing a Close lead ID.",
    );
  }
  const task = objectAt(event.payload, "task");
  await close.createTask({
    _type: "lead",
    lead_id: leadId,
    text: stringAt(task, "text") ?? "Incomplete qualification follow-up",
    date: stringAt(task, "date") ?? new Date().toISOString().slice(0, 10),
    ...(closeConfig.followUpAssignedTo
      ? { assigned_to: closeConfig.followUpAssignedTo }
      : {}),
    is_complete: false,
  });
  return {
    leadId,
    contactId: event.close_contact_id ?? lead?.close_contact_id ?? null,
  };
}

async function listDueCloseSyncEvents(
  client: CloseSyncClient,
  nowIso: string,
  maxEvents = 20,
): Promise<CloseSyncEventRow[]> {
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(maxEvents);

  if (error) throw new Error("Could not list due Close sync events.");
  return ((data ?? []) as CloseSyncEventRow[]).filter((event) =>
    RETRYABLE_STATUSES.has(event.status),
  );
}

async function getCloseSyncEvent(
  client: CloseSyncClient,
  eventId: string,
): Promise<CloseSyncEventRow | null> {
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .eq("id", eventId)
    .single();
  if (error) return null;
  return data as CloseSyncEventRow;
}

async function getLead(
  client: CloseSyncClient,
  leadId: string,
): Promise<LeadRow | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .eq("id", leadId)
    .single();

  if (error || !data) return null;
  return data as LeadRow;
}

async function updateEvent(
  client: CloseSyncClient,
  eventId: string,
  patch: CloseSyncEventUpdate,
) {
  const { error } = await client
    .from("close_sync_events")
    .update(patch)
    .eq("id", eventId);
  if (error) throw new Error("Could not update Close sync event.");
}

async function updateLead(
  client: CloseSyncClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);
  if (error) throw new Error("Could not update lead Close sync state.");
}

async function recordNeedsReview(
  client: CloseSyncClient,
  event: CloseSyncEventRow,
  {
    attemptCount,
    nowIso,
    message,
  }: { attemptCount: number; nowIso: string; message: string },
) {
  const safeMessage = boundedError(message);
  await updateEvent(client, event.id, {
    status: "needs_review",
    attempt_count: attemptCount,
    last_attempted_at: nowIso,
    last_error: safeMessage,
  });
  if (event.lead_submission_id) {
    await updateLead(client, event.lead_submission_id, {
      close_sync_status: "needs_review",
      close_sync_attempt_count: attemptCount,
      close_sync_last_attempted_at: nowIso,
      close_sync_last_error: safeMessage,
    });
  }
}

function contactPayload(
  event: CloseSyncEventRow,
  lead: LeadRow | null,
): CloseContactPayload {
  const contact = objectAt(event.payload, "contact");
  const fullName = stringAt(contact, "full_name") ?? lead?.full_name;
  const email = stringAt(contact, "email") ?? lead?.email;
  const phone = stringAt(contact, "phone") ?? lead?.phone;
  return {
    ...(fullName ? { name: fullName } : {}),
    ...(email ? { emails: [{ email, type: "office" }] } : {}),
    ...(phone ? { phones: [{ phone, type: "mobile" }] } : {}),
  };
}

function primaryEmail(event: CloseSyncEventRow, lead: LeadRow | null) {
  return (
    stringAt(objectAt(event.payload, "contact"), "email") ?? lead?.email ?? null
  );
}

function qualificationCustomFields(
  payload: Json,
  closeConfig: CloseConfig,
): Record<`custom.${string}`, unknown> {
  const qualification = objectAt(payload, "qualification");
  const normalized = objectAt(payload, "normalized");
  const attribution = objectAt(payload, "attribution");
  return closeCustomFieldPayload(
    {
      ...sourceAttributionValues(attribution, null),
      status: stringAt(qualification, "status"),
      experiment_key: stringAt(qualification, "experimentKey"),
      variant_key: stringAt(qualification, "variantKey"),
      score: numberAt(qualification, "score"),
      band: stringAt(qualification, "band"),
      state_market: stringAt(normalized, "state_market"),
      business_stage: stringAt(normalized, "business_stage"),
      budget_range: stringAt(normalized, "budget_range"),
      available_capital: stringAt(normalized, "available_capital"),
      timeline: stringAt(normalized, "timeline"),
      location_status: stringAt(normalized, "location_status"),
      machine_goal: stringAt(normalized, "machine_goal"),
      goal: stringAt(normalized, "goal"),
      consent: stringAt(normalized, "consent"),
      completed_at: stringAt(qualification, "completedAt"),
    },
    closeConfig.customFields,
  );
}

function sourceCustomFields(
  event: CloseSyncEventRow,
  lead: LeadRow | null,
  closeConfig: CloseConfig,
): Record<`custom.${string}`, unknown> {
  const attribution = objectAt(event.payload, "attribution");
  return closeCustomFieldPayload(
    sourceAttributionValues(attribution, lead),
    closeConfig.customFields,
  );
}

function sourceAttributionValues(
  attribution: Record<string, Json>,
  lead: LeadRow | null,
) {
  const values: Record<string, unknown> = {};
  for (const [attributionKey, leadKey] of LEAD_SOURCE_FIELDS) {
    values[attributionKey] =
      stringAt(attribution, attributionKey) ?? lead?.[leadKey];
  }
  for (const key of SESSION_ATTRIBUTION_FIELDS) {
    values[key] = stringAt(attribution, key);
  }
  for (const key of PAID_ATTRIBUTION_FIELDS) {
    values[key] = stringAt(attribution, key);
  }
  return values;
}

function qualificationNoteHtml(payload: Json) {
  const qualification = objectAt(payload, "qualification");
  const answers = arrayAt(payload, "answers");
  const rows = answers
    .map((answer) => {
      const answerObject =
        answer && typeof answer === "object" && !Array.isArray(answer)
          ? (answer as Record<string, Json>)
          : {};
      const label = stringAt(answerObject, "label") ?? "Question";
      const value = stringAt(answerObject, "value") ?? JSON.stringify(answer);
      return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`;
    })
    .join("");

  return [
    "<body>",
    "<h2>Qualification completed</h2>",
    `<p>Status: ${escapeHtml(stringAt(qualification, "status") ?? "qualified")}</p>`,
    rows ? `<ul>${rows}</ul>` : "",
    "</body>",
  ].join("");
}

function sanitizeSyncError(error: unknown, apiKey?: string) {
  if (error instanceof CloseConfigError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  return boundedError(sanitizeCloseErrorText(message, apiKey));
}

function nextRetryAt(now: Date, attemptCount: number) {
  const minutes = Math.min(5 * 2 ** Math.max(0, attemptCount - 1), 24 * 60);
  return new Date(now.getTime() + minutes * 60 * 1000);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
