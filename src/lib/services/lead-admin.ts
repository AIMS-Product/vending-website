import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

type LeadRow = Tables<"lead_submissions">;
type SessionRow = Tables<"qualification_sessions">;
type AnswerRow = Tables<"qualification_answers">;
type EventRow = Tables<"close_sync_events">;
type LeadAdminClient = Pick<SupabaseClient<Database>, "from">;
type CloseSyncEventUpdate =
  Database["public"]["Tables"]["close_sync_events"]["Update"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];

type ServiceDeps = {
  client?: LeadAdminClient;
  now?: () => Date;
};

export type AdminListLeadsInput = {
  lifecycleStatus?: string | null;
  closeSyncStatus?: string | null;
};

export type AdminGetLeadDetailInput = {
  leadId: string;
};

export type AdminRetryCloseSyncEventInput = {
  eventId: string;
  requestedBy?: string | null;
};

export type AdminCloseSyncEventSummary = {
  id: string;
  eventType: string;
  status: string;
  lastError: string | null;
  nextRetryAt: string | null;
  syncedAt: string | null;
};

export type AdminLeadListItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  lifecycleStatus: string;
  qualificationStatus: string | null;
  closeSyncStatus: string | null;
  closeSyncLastError: string | null;
  sourcePath: string | null;
  landingPath: string | null;
  sourcePageSlug: string | null;
  sourceBlockId: string | null;
  sourceCtaTrackingName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  experimentKey: string | null;
  variantKey: string | null;
  createdAt: string;
  latestCloseSyncEvent: AdminCloseSyncEventSummary | null;
};

export type AdminLeadSessionSummary = {
  id: string;
  status: string;
  answerCount: number;
  currentQuestionId: string | null;
  normalizedSummary: Json;
  experimentKey: string | null;
  variantKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  staleAt: string;
  expiresAt: string;
};

export type AdminLeadAnswerSummary = {
  id: string;
  questionId: string;
  questionLabel: string;
  questionType: string;
  normalizedRole: string | null;
  displayValue: string;
  answeredAt: string;
};

export type AdminLeadDetail = AdminLeadListItem & {
  message: string | null;
  stateRegion: string | null;
  businessStage: string | null;
  budget: string | null;
  timeline: string | null;
  qualificationSummary: Json;
  sessions: AdminLeadSessionSummary[];
  answers: AdminLeadAnswerSummary[];
  closeSyncEvents: AdminCloseSyncEventSummary[];
};

export type AdminRetryCloseSyncEventResult = {
  status: "queued";
  eventId: string;
  leadId: string | null;
};

export class LeadAdminServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadAdminServiceError";
  }
}

const LEAD_FIELDS =
  "id,full_name,email,phone,message,state_region,business_stage,budget,timeline,lifecycle_status,qualification_summary,latest_qualification_session_id,close_sync_status,close_sync_last_error,source_path,landing_path,source_page_slug,source_block_id,source_cta_tracking_name,utm_source,utm_medium,utm_campaign,created_at" as const;
const SESSION_FIELDS =
  "id,lead_submission_id,status,answer_count,current_question_id,normalized_summary,experiment_key,variant_key,started_at,completed_at,stale_at,expires_at,created_at" as const;
const ANSWER_FIELDS =
  "id,lead_submission_id,session_id,question_id,question_type,normalized_role,question_snapshot,answer_value,normalized_value,answered_at,created_at" as const;
const EVENT_FIELDS =
  "id,lead_submission_id,session_id,event_type,status,last_error,next_retry_at,synced_at,created_at,updated_at" as const;
const RETRYABLE_EVENT_STATUSES = new Set([
  "failed",
  "needs_review",
  "dead_letter",
]);

export async function adminListLeads(
  input: AdminListLeadsInput & ServiceDeps = {},
): Promise<AdminLeadListItem[]> {
  const client = serviceClient(input);
  let query = client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (input.lifecycleStatus && input.lifecycleStatus !== "all") {
    query = query.eq("lifecycle_status", input.lifecycleStatus);
  }
  if (input.closeSyncStatus && input.closeSyncStatus !== "all") {
    query = query.eq("close_sync_status", input.closeSyncStatus);
  }

  const { data, error } = await query;
  if (error) throw new LeadAdminServiceError("Could not list leads.");

  const leads = (data ?? []) as LeadRow[];
  if (!leads.length) return [];

  const leadIds = leads.map((lead) => lead.id);
  const [sessions, events] = await Promise.all([
    listSessionsForLeads(client, leadIds),
    listCloseSyncEventsForLeads(client, leadIds),
  ]);
  const latestSessionByLead = firstByLeadId(sessions);
  const latestEventByLead = firstByLeadId(events);

  return leads.map((lead) =>
    mapLeadListItem(
      lead,
      latestSessionByLead.get(lead.id) ?? null,
      latestEventByLead.get(lead.id) ?? null,
    ),
  );
}

export async function adminGetLeadDetail(
  input: AdminGetLeadDetailInput,
  deps: ServiceDeps = {},
): Promise<AdminLeadDetail | null> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .eq("id", input.leadId)
    .maybeSingle();

  if (error) throw new LeadAdminServiceError("Could not load lead.");
  if (!data) return null;

  const lead = data as LeadRow;
  const [sessions, answers, events] = await Promise.all([
    listSessionsForLead(client, lead.id),
    listAnswersForLead(client, lead.id),
    listCloseSyncEventsForLead(client, lead.id),
  ]);
  const latestSession = sessions[0] ?? null;
  const latestEvent = events[0] ?? null;

  return {
    ...mapLeadListItem(lead, latestSession, latestEvent),
    message: lead.message,
    stateRegion: lead.state_region,
    businessStage: lead.business_stage,
    budget: lead.budget,
    timeline: lead.timeline,
    qualificationSummary: lead.qualification_summary,
    sessions: sessions.map(mapSession),
    answers: answers.map(mapAnswer),
    closeSyncEvents: events.map(mapEvent),
  };
}

export async function adminRetryCloseSyncEvent(
  input: AdminRetryCloseSyncEventInput,
  deps: ServiceDeps = {},
): Promise<AdminRetryCloseSyncEventResult> {
  const client = serviceClient(deps);
  const nowIso = (deps.now?.() ?? new Date()).toISOString();
  const event = await getCloseSyncEvent(client, input.eventId);
  if (!event) throw new LeadAdminServiceError("Close sync event not found.");

  if (event.status === "synced") {
    throw new LeadAdminServiceError("Synced Close events cannot be retried.");
  }
  if (!RETRYABLE_EVENT_STATUSES.has(event.status)) {
    throw new LeadAdminServiceError(
      "Only failed Close sync events can be retried.",
    );
  }

  await updateCloseSyncEvent(client, event.id, {
    status: "pending",
    next_retry_at: nowIso,
    last_error: null,
    synced_at: null,
  });

  if (event.lead_submission_id) {
    await updateLead(client, event.lead_submission_id, {
      close_sync_status: "pending",
      close_sync_next_retry_at: nowIso,
      close_sync_last_error: null,
    });
  }

  void input.requestedBy;
  return {
    status: "queued",
    eventId: event.id,
    leadId: event.lead_submission_id,
  };
}

function serviceClient(deps: ServiceDeps): LeadAdminClient {
  return deps.client ?? createAdminClient();
}

async function listSessionsForLeads(
  client: LeadAdminClient,
  leadIds: string[],
) {
  const { data, error } = await client
    .from("qualification_sessions")
    .select(SESSION_FIELDS)
    .in("lead_submission_id", leadIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new LeadAdminServiceError("Could not list qualification sessions.");
  }
  return (data ?? []) as SessionRow[];
}

async function listSessionsForLead(client: LeadAdminClient, leadId: string) {
  const { data, error } = await client
    .from("qualification_sessions")
    .select(SESSION_FIELDS)
    .eq("lead_submission_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new LeadAdminServiceError("Could not list qualification sessions.");
  }
  return (data ?? []) as SessionRow[];
}

async function listAnswersForLead(client: LeadAdminClient, leadId: string) {
  const { data, error } = await client
    .from("qualification_answers")
    .select(ANSWER_FIELDS)
    .eq("lead_submission_id", leadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new LeadAdminServiceError("Could not list qualification answers.");
  }
  return (data ?? []) as AnswerRow[];
}

async function listCloseSyncEventsForLeads(
  client: LeadAdminClient,
  leadIds: string[],
) {
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .in("lead_submission_id", leadIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new LeadAdminServiceError("Could not list Close sync events.");
  }
  return (data ?? []) as EventRow[];
}

async function listCloseSyncEventsForLead(
  client: LeadAdminClient,
  leadId: string,
) {
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .eq("lead_submission_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new LeadAdminServiceError("Could not list Close sync events.");
  }
  return (data ?? []) as EventRow[];
}

async function getCloseSyncEvent(
  client: LeadAdminClient,
  eventId: string,
): Promise<EventRow | null> {
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .eq("id", eventId)
    .single();

  if (error || !data) return null;
  return data as EventRow;
}

async function updateCloseSyncEvent(
  client: LeadAdminClient,
  eventId: string,
  patch: CloseSyncEventUpdate,
) {
  const { error } = await client
    .from("close_sync_events")
    .update(patch)
    .eq("id", eventId);

  if (error) {
    throw new LeadAdminServiceError("Could not update Close sync event.");
  }
}

async function updateLead(
  client: LeadAdminClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);

  if (error)
    throw new LeadAdminServiceError("Could not update lead sync state.");
}

function firstByLeadId<Row extends { lead_submission_id: string | null }>(
  rows: Row[],
) {
  const result = new Map<string, Row>();
  for (const row of rows) {
    if (!row.lead_submission_id || result.has(row.lead_submission_id)) continue;
    result.set(row.lead_submission_id, row);
  }
  return result;
}

function mapLeadListItem(
  lead: LeadRow,
  session: SessionRow | null,
  event: EventRow | null,
): AdminLeadListItem {
  return {
    id: lead.id,
    fullName: lead.full_name,
    email: lead.email,
    phone: lead.phone,
    lifecycleStatus: lead.lifecycle_status,
    qualificationStatus: session?.status ?? null,
    closeSyncStatus: lead.close_sync_status,
    closeSyncLastError: lead.close_sync_last_error,
    sourcePath: lead.source_path,
    landingPath: lead.landing_path,
    sourcePageSlug: lead.source_page_slug,
    sourceBlockId: lead.source_block_id,
    sourceCtaTrackingName: lead.source_cta_tracking_name,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    experimentKey: session?.experiment_key ?? null,
    variantKey: session?.variant_key ?? null,
    createdAt: lead.created_at,
    latestCloseSyncEvent: event ? mapEvent(event) : null,
  };
}

function mapSession(session: SessionRow): AdminLeadSessionSummary {
  return {
    id: session.id,
    status: session.status,
    answerCount: session.answer_count,
    currentQuestionId: session.current_question_id,
    normalizedSummary: session.normalized_summary,
    experimentKey: session.experiment_key,
    variantKey: session.variant_key,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    staleAt: session.stale_at,
    expiresAt: session.expires_at,
  };
}

function mapAnswer(answer: AnswerRow): AdminLeadAnswerSummary {
  return {
    id: answer.id,
    questionId: answer.question_id,
    questionLabel: questionLabel(answer.question_snapshot),
    questionType: answer.question_type,
    normalizedRole: answer.normalized_role,
    displayValue: displayJsonValue(answer.answer_value),
    answeredAt: answer.answered_at,
  };
}

function mapEvent(event: EventRow): AdminCloseSyncEventSummary {
  return {
    id: event.id,
    eventType: event.event_type,
    status: event.status,
    lastError: event.last_error,
    nextRetryAt: event.next_retry_at,
    syncedAt: event.synced_at,
  };
}

function questionLabel(snapshot: Json): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "Question";
  }
  const label = snapshot.label;
  return typeof label === "string" && label.trim() ? label : "Question";
}

function displayJsonValue(value: Json): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(displayJsonValue).join(", ");
  }
  if (value && typeof value === "object") {
    const label = value.label;
    const rawValue = value.value;
    if (typeof label === "string") return label;
    if (typeof rawValue === "string") return rawValue;
  }
  return JSON.stringify(value);
}
