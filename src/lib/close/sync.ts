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
  closeContactAttributionPayload,
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

const RETRYABLE_STATUS_LIST = ["pending", "failed", "retrying"] as const;
const RETRYABLE_STATUSES = new Set<string>(RETRYABLE_STATUS_LIST);
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
    // The bookkeeping writes inside processCloseSyncEvent sit outside its own
    // try block and throw on any PostgREST error. Without this guard one bad
    // write 500s the cron route and abandons every remaining event in the
    // batch with nothing recorded against them.
    let processed: Awaited<ReturnType<typeof processCloseSyncEvent>>;
    try {
      processed = await processCloseSyncEvent(event, {
        client,
        closeConfig,
        fetchImpl: deps.fetchImpl,
        now,
      });
    } catch (error) {
      result.errors.push({
        eventId: event.id,
        message: sanitizeSyncError(error, closeConfig.apiKey),
      });
      continue;
    }
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
  const claimed = await claimEvent(client, event, {
    status: "retrying",
    attempt_count: attemptCount,
    last_attempted_at: nowIso,
    last_error: null,
    // Lease the event so a drain that starts while this one is mid-flight
    // doesn't see it as due. Both the success and failure paths below set
    // next_retry_at again, so the lease never outlives the attempt.
    next_retry_at: claimLeaseUntil(now).toISOString(),
  });
  // Another drain got here first. Bail out before touching Close: the status
  // check above only sees this run's snapshot, and "retrying" is itself
  // retryable, so without the claim two concurrent drains would both call
  // createLead and produce duplicate Close records for one person.
  if (!claimed) return "skipped";
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

type SourceFields = {
  lead: Record<`custom.${string}`, unknown>;
  contact: Record<`custom.${string}`, unknown>;
};

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
    sourceFields: SourceFields;
  },
): Promise<CloseContactInfo> {
  const email = primaryEmail(event, lead);
  const match = await matchedContactForEmail(close, email);
  if (match)
    return updateMatchedCloseContact(close, match, contact, sourceFields);

  const created = await close.createLead(
    createLeadPayload({ closeConfig, contact, email, lead, sourceFields }),
  );
  const contactId =
    created.contacts?.[0]?.id ?? created.contact_ids?.[0] ?? null;

  // The contact only exists once the lead is created, so its UTM fields are
  // written here rather than nested in the create payload.
  if (contactId && Object.keys(sourceFields.contact).length) {
    await close.updateContact(contactId, sourceFields.contact);
  }

  return { leadId: created.id, contactId };
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
  sourceFields: SourceFields;
}) {
  return {
    name: contact.name ?? lead?.full_name ?? email ?? "Website lead",
    ...leadStatusPayload(closeConfig),
    ...sourceFields.lead,
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
    sourceFields: SourceFields;
  },
): Promise<CloseContactInfo> {
  if (contactId) {
    await updateContactAdditively(close, contactId, contact, {
      ...sourceFields.contact,
    });
  }
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
  sourceFields: SourceFields,
): Promise<CloseContactInfo> {
  if (!match.lead_id) {
    throw new CloseNeedsReviewError(
      `Close contact ${match.id} did not include a parent lead.`,
    );
  }
  await updateContactAdditively(close, match.id, contact, {
    ...sourceFields.contact,
  });
  await updateCloseLeadSourceFields(close, match.lead_id, sourceFields);
  return { leadId: match.lead_id, contactId: match.id };
}

/**
 * Update a Close contact that already exists without rewriting who it is.
 *
 * Both callers reach a contact that this submit did not necessarily own: the
 * email-match path resolves a stranger's contact from an unauthenticated public
 * form, and the known-lead path can be pointed at that same contact once the
 * match has been recorded on our lead row. Close's `PUT /contact/` replaces
 * every array it receives wholesale, so passing the submitted `name`/`phones`
 * through let anyone who knows a customer's email address replace that
 * customer's name and phone number in the CRM, and sales would then dial the
 * attacker.
 *
 * Product decision (2026-07-31): never touch `name`, and only ever ADD an email
 * or phone to what Close already holds. Full contact details are still written
 * at creation time, where the contact is genuinely ours.
 */
async function updateContactAdditively(
  close: CloseClient,
  contactId: string,
  contact: CloseContactPayload,
  contactFields: Record<string, unknown>,
) {
  const existing = await close.getContact(contactId);
  const emails = appendedContactEntries(
    "email",
    existing.emails,
    contact.emails,
  );
  const phones = appendedContactEntries(
    "phone",
    existing.phones,
    contact.phones,
  );
  const payload = {
    ...(emails ? { emails } : {}),
    ...(phones ? { phones } : {}),
    ...contactFields,
  };
  if (Object.keys(payload).length) {
    await close.updateContact(contactId, payload);
  }
}

/**
 * What Close accepts back on a write, per entry type. Verified against a real
 * `GET /contact/{id}/` on the production org: entries come back carrying more
 * than this — `country` and `phone_formatted` on phones — and those are derived,
 * so echoing them into a PUT sends Close its own computed values.
 *
 * `is_unsubscribed` is in the list on purpose. It is writable, and rebuilding an
 * email entry without it would resubscribe someone who had opted out, silently,
 * as a side effect of a stranger filling in a form.
 */
const WRITABLE_ENTRY_FIELDS = {
  email: ["email", "type", "is_unsubscribed"],
  phone: ["phone", "type"],
} as const;

/**
 * The existing entries plus any submitted entry Close does not already hold, or
 * null when there is nothing new — omitting the key is what preserves the array.
 *
 * ponytail: exact string comparison, so the same number in two formats
 * ("555-0100" vs "5550100") appends twice. Normalize to digits if that shows up.
 */
function appendedContactEntries<K extends "email" | "phone">(
  key: K,
  existing: Array<Record<string, unknown>> = [],
  incoming: Array<Record<string, unknown>> = [],
) {
  const value = (entry: Record<string, unknown>) => {
    const raw = entry[key];
    return typeof raw === "string" ? raw.trim().toLowerCase() : null;
  };
  const known = new Set(existing.map(value));
  const added = incoming.filter(
    (entry) => value(entry) && !known.has(value(entry)),
  );
  if (!added.length) return null;
  return [...existing.map((entry) => writableEntry(key, entry)), ...added];
}

function writableEntry<K extends "email" | "phone">(
  key: K,
  entry: Record<string, unknown>,
) {
  return Object.fromEntries(
    WRITABLE_ENTRY_FIELDS[key]
      .filter((field) => entry[field] !== undefined)
      .map((field) => [field, entry[field]]),
  );
}

async function updateCloseLeadSourceFields(
  close: CloseClient,
  leadId: string,
  sourceFields: SourceFields,
) {
  if (Object.keys(sourceFields.lead).length)
    await close.updateLead(leadId, sourceFields.lead);
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
    // Retryable, NOT needs_review. The Close record is created by this lead's
    // lead_create_or_update event, which normally drains first because it was
    // queued earlier. One transient Close 5xx on that event pushes its
    // next_retry_at forward and inverts the order — and needs_review is
    // terminal, so parking here would strand the score, band, and answers
    // outside Close forever with nothing to alert on. Retrying lets the
    // ordering resolve itself; a genuinely unresolvable event still
    // dead-letters after max_attempts.
    throw new Error("Qualification enrichment is missing a Close lead ID.");
  }
  const contactId = event.close_contact_id ?? lead?.close_contact_id ?? null;
  await close.createNote({
    lead_id: leadId,
    contact_id: contactId,
    note_html: qualificationNoteHtml(event.payload),
  });

  // Custom fields are scope-locked in Close: lead-scoped IDs must go on the lead,
  // contact-scoped IDs on the contact. Sending a contact field to updateLead (or
  // vice versa) makes Close reject the whole update with a 400, so we split by
  // scope and write each group to its own object.
  const leadFields = qualificationLeadCustomFields(event.payload, closeConfig);
  if (Object.keys(leadFields).length) {
    await close.updateLead(leadId, leadFields);
  }
  const contactFields = qualificationContactCustomFields(
    event.payload,
    closeConfig,
  );
  if (Object.keys(contactFields).length) {
    if (!contactId) {
      throw new CloseNeedsReviewError(
        "Qualification enrichment has contact-scoped custom fields but no Close contact ID.",
      );
    }
    await close.updateContact(contactId, contactFields);
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
  // Filter status in the query — NOT in memory after .limit() — so parked
  // events (needs_review / synced / dead_letter) with an old next_retry_at
  // can't fill the fetch window and starve retryable events behind them.
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .in("status", RETRYABLE_STATUS_LIST as unknown as string[])
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

/**
 * Take exclusive ownership of a due event before doing any external work.
 *
 * The queue is drained from three places at once — the every-2-minute Vercel
 * cron plus an `after()` hook on both the stage-1 and stage-2 form submits —
 * so two runs routinely list the same due rows. This is a compare-and-swap on
 * `attempt_count`: the claim increments it, so a second drain holding the same
 * snapshot matches zero rows and skips the event instead of double-processing
 * it. Guarding on status alone would not be enough, because the claim sets
 * "retrying", which is itself a retryable status.
 *
 * Returns true when this run owns the event.
 */
async function claimEvent(
  client: CloseSyncClient,
  event: CloseSyncEventRow,
  patch: CloseSyncEventUpdate,
): Promise<boolean> {
  const { data, error } = await client
    .from("close_sync_events")
    .update(patch)
    .eq("id", event.id)
    .eq("attempt_count", event.attempt_count)
    .in("status", RETRYABLE_STATUS_LIST as unknown as string[])
    .select("id");

  if (error) throw new Error("Could not claim Close sync event.");
  return (data ?? []).length > 0;
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
    ...(email ? { emails: [{ email, type: "direct" }] } : {}),
    ...(phone ? { phones: [{ phone, type: "direct" }] } : {}),
  };
}

function primaryEmail(event: CloseSyncEventRow, lead: LeadRow | null) {
  return (
    stringAt(objectAt(event.payload, "contact"), "email") ?? lead?.email ?? null
  );
}

// Lead-scoped qualification fields: attribution/source + the qualification
// analytics that describe the opportunity (status, experiment, score, band,
// completed_at). When their field IDs are created in Close they must be
// LEAD-scoped to match this update path.
function qualificationLeadCustomFields(
  payload: Json,
  closeConfig: CloseConfig,
): Record<`custom.${string}`, unknown> {
  const qualification = objectAt(payload, "qualification");
  const attribution = objectAt(payload, "attribution");
  return closeCustomFieldPayload(
    {
      ...sourceAttributionValues(attribution, null),
      status: stringAt(qualification, "status"),
      experiment_key: stringAt(qualification, "experimentKey"),
      variant_key: stringAt(qualification, "variantKey"),
      score: numberAt(qualification, "score"),
      band: stringAt(qualification, "band"),
      completed_at: stringAt(qualification, "completedAt"),
    },
    closeConfig.customFields,
  );
}

// Contact-scoped qualification fields: the person's own answers + consent.
// Stephen configured timeline / available_capital / consent (guide opt-in) /
// contact_preference (SMS) as CONTACT custom fields in Close, so these are
// written with updateContact — Close 400s if a contact-scoped field ID is sent
// on a lead update.
function qualificationContactCustomFields(
  payload: Json,
  closeConfig: CloseConfig,
): Record<`custom.${string}`, unknown> {
  const normalized = objectAt(payload, "normalized");
  return closeCustomFieldPayload(
    {
      state_market: stringAt(normalized, "state_market"),
      business_stage: stringAt(normalized, "business_stage"),
      budget_range: stringAt(normalized, "budget_range"),
      available_capital: stringAt(normalized, "available_capital"),
      timeline: stringAt(normalized, "timeline"),
      location_status: stringAt(normalized, "location_status"),
      machine_goal: stringAt(normalized, "machine_goal"),
      goal: stringAt(normalized, "goal"),
      consent: stringAt(normalized, "consent"),
      contact_preference: stringAt(normalized, "contact_preference"),
    },
    closeConfig.customFields,
  );
}

/**
 * Attribution split by Close's field scoping: UTMs are contact fields, the rest
 * (source path, click IDs, campaign/ad IDs) are lead fields. Close 400s the whole
 * update if either group is sent to the wrong object.
 */
function sourceCustomFields(
  event: CloseSyncEventRow,
  lead: LeadRow | null,
  closeConfig: CloseConfig,
): SourceFields {
  const attribution = objectAt(event.payload, "attribution");
  const values = sourceAttributionValues(attribution, lead);
  return {
    lead: closeCustomFieldPayload(values, closeConfig.customFields),
    contact: closeContactAttributionPayload(values, closeConfig.customFields),
  };
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

/**
 * How long a claimed event stays invisible to other drains.
 *
 * Long enough to cover the slowest Close round trip, short enough that an
 * event orphaned by a crashed or timed-out run is retried promptly.
 */
const CLAIM_LEASE_MINUTES = 5;

function claimLeaseUntil(now: Date) {
  return new Date(now.getTime() + CLAIM_LEASE_MINUTES * 60 * 1000);
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
