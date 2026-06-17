import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

type QualificationSessionRow = Tables<"qualification_sessions">;
type CloseSyncEventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;
type QualificationLifecycleClient = Pick<SupabaseClient<Database>, "from">;
type QualificationSessionUpdate =
  Database["public"]["Tables"]["qualification_sessions"]["Update"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];
type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];

export type AdminRunQualificationLifecycleResult = {
  scanned: number;
  markedStale: number;
  markedExpired: number;
  taskEventsCreated: number;
  taskEventsSkipped: number;
  skipped: number;
  errors: Array<{ sessionId: string; message: string }>;
};

export type AdminRunQualificationLifecycleDeps = {
  client?: QualificationLifecycleClient;
  now?: () => Date;
  maxSessions?: number;
};

class QualificationLifecycleServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationLifecycleServiceError";
  }
}

const SESSION_FIELDS =
  "id,lead_submission_id,form_id,form_version_id,status,completion_redirect_path,source_path,landing_path,referrer,user_agent,utm_source,utm_medium,utm_campaign,utm_term,utm_content,source_page_id,source_page_slug,source_block_id,source_cta_tracking_name,target_keyword,experiment_key,variant_key,current_question_id,answer_count,normalized_summary,stale_at,expires_at,started_at,completed_at,created_at,updated_at" as const;
const LEAD_FIELDS =
  "id,full_name,email,close_lead_id,close_contact_id,lifecycle_status,close_sync_status,close_sync_next_retry_at" as const;
const EVENT_FIELDS =
  "id,lead_submission_id,session_id,event_type,status,dedupe_key,payload,close_lead_id,close_contact_id,attempt_count,max_attempts,next_retry_at,last_attempted_at,synced_at,last_error,created_at,updated_at" as const;
const INCOMPLETE_SESSION_STATUSES = ["pending", "in_progress", "stale"];
const STALE_SESSION_STATUSES = ["pending", "in_progress", "stale"];

export async function adminRunQualificationLifecycle(
  deps: AdminRunQualificationLifecycleDeps = {},
): Promise<AdminRunQualificationLifecycleResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const maxSessions = deps.maxSessions ?? 100;
  const result: AdminRunQualificationLifecycleResult = {
    scanned: 0,
    markedStale: 0,
    markedExpired: 0,
    taskEventsCreated: 0,
    taskEventsSkipped: 0,
    skipped: 0,
    errors: [],
  };

  const expiredSessions = await listExpiredSessions(
    client,
    nowIso,
    maxSessions,
  );
  for (const session of expiredSessions) {
    result.scanned += 1;
    try {
      const marked = await expireSession(client, session);
      result.markedExpired += marked ? 1 : 0;
    } catch (error) {
      result.errors.push({
        sessionId: session.id,
        message: lifecycleErrorMessage(error),
      });
    }
  }

  const staleSessions = await listStaleSessions(client, nowIso, maxSessions);
  for (const session of staleSessions) {
    if (session.expires_at <= nowIso) continue;
    result.scanned += 1;
    try {
      const processed = await markSessionStale(client, session, nowIso);
      result.markedStale += processed.marked ? 1 : 0;
      result.taskEventsCreated += processed.taskEvent === "created" ? 1 : 0;
      result.taskEventsSkipped += processed.taskEvent === "exists" ? 1 : 0;
      result.skipped += processed.taskEvent === "skipped" ? 1 : 0;
    } catch (error) {
      result.errors.push({
        sessionId: session.id,
        message: lifecycleErrorMessage(error),
      });
    }
  }

  return result;
}

async function listExpiredSessions(
  client: QualificationLifecycleClient,
  nowIso: string,
  maxSessions: number,
) {
  const { data, error } = await client
    .from("qualification_sessions")
    .select(SESSION_FIELDS)
    .in("status", INCOMPLETE_SESSION_STATUSES)
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(maxSessions);

  if (error) {
    throw new QualificationLifecycleServiceError(
      "Could not list expired qualification sessions.",
    );
  }
  return (data ?? []) as QualificationSessionRow[];
}

async function listStaleSessions(
  client: QualificationLifecycleClient,
  nowIso: string,
  maxSessions: number,
) {
  const { data, error } = await client
    .from("qualification_sessions")
    .select(SESSION_FIELDS)
    .in("status", STALE_SESSION_STATUSES)
    .lte("stale_at", nowIso)
    .order("stale_at", { ascending: true })
    .limit(maxSessions);

  if (error) {
    throw new QualificationLifecycleServiceError(
      "Could not list stale qualification sessions.",
    );
  }
  return (data ?? []) as QualificationSessionRow[];
}

async function expireSession(
  client: QualificationLifecycleClient,
  session: QualificationSessionRow,
) {
  if (session.status !== "expired") {
    await updateSession(client, session.id, {
      status: "expired",
      current_question_id: null,
    });
  }

  const lead = await getLead(client, session.lead_submission_id);
  if (lead && lead.lifecycle_status !== "qualified") {
    await updateLead(client, lead.id, {
      lifecycle_status: "qualification_expired",
    });
  }

  return session.status !== "expired";
}

async function markSessionStale(
  client: QualificationLifecycleClient,
  session: QualificationSessionRow,
  nowIso: string,
): Promise<{ marked: boolean; taskEvent: "created" | "exists" | "skipped" }> {
  const wasAlreadyStale = session.status === "stale";
  if (!wasAlreadyStale) {
    await updateSession(client, session.id, {
      status: "stale",
    });
  }

  const lead = await getLead(client, session.lead_submission_id);
  if (!lead) return { marked: !wasAlreadyStale, taskEvent: "skipped" };

  if (lead.lifecycle_status === "qualified") {
    return { marked: !wasAlreadyStale, taskEvent: "skipped" };
  }

  await updateLead(client, lead.id, {
    lifecycle_status: "qualification_stale",
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
    close_sync_last_error: null,
  });

  const taskEvent = await ensureStaleFollowUpTaskEvent(client, {
    session,
    lead,
    nowIso,
  });
  return { marked: !wasAlreadyStale, taskEvent };
}

async function ensureStaleFollowUpTaskEvent(
  client: QualificationLifecycleClient,
  {
    session,
    lead,
    nowIso,
  }: { session: QualificationSessionRow; lead: LeadRow; nowIso: string },
): Promise<"created" | "exists"> {
  const dedupeKey = staleTaskDedupeKey(session.id);
  const existing = await getCloseSyncEventByDedupeKey(client, dedupeKey);
  if (existing) return "exists";

  const event: CloseSyncEventInsert = {
    lead_submission_id: session.lead_submission_id,
    session_id: session.id,
    event_type: "stale_follow_up_task",
    status: "pending",
    dedupe_key: dedupeKey,
    next_retry_at: nowIso,
    close_lead_id: lead.close_lead_id,
    close_contact_id: lead.close_contact_id,
    payload: staleTaskPayload(session, lead, nowIso),
  };

  const { error } = await client
    .from("close_sync_events")
    .insert(event)
    .select("id")
    .single();

  if (error) {
    if (isDuplicateDedupeError(error)) return "exists";
    throw new QualificationLifecycleServiceError(
      "Could not queue stale qualification follow-up task.",
    );
  }
  return "created";
}

async function getCloseSyncEventByDedupeKey(
  client: QualificationLifecycleClient,
  dedupeKey: string,
): Promise<CloseSyncEventRow | null> {
  const { data, error } = await client
    .from("close_sync_events")
    .select(EVENT_FIELDS)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (error) {
    throw new QualificationLifecycleServiceError(
      "Could not check stale follow-up task idempotency.",
    );
  }
  return data as CloseSyncEventRow | null;
}

async function getLead(
  client: QualificationLifecycleClient,
  leadId: string,
): Promise<LeadRow | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    throw new QualificationLifecycleServiceError(
      "Could not load qualification lead.",
    );
  }
  return data as LeadRow | null;
}

async function updateSession(
  client: QualificationLifecycleClient,
  sessionId: string,
  patch: QualificationSessionUpdate,
) {
  const { error } = await client
    .from("qualification_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) {
    throw new QualificationLifecycleServiceError(
      "Could not update qualification session lifecycle.",
    );
  }
}

async function updateLead(
  client: QualificationLifecycleClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);
  if (error) {
    throw new QualificationLifecycleServiceError(
      "Could not update lead qualification lifecycle.",
    );
  }
}

function staleTaskDedupeKey(sessionId: string) {
  return `stale_follow_up_task:${sessionId}`;
}

function staleTaskPayload(
  session: QualificationSessionRow,
  lead: LeadRow,
  nowIso: string,
): Json {
  return {
    source: "qualification_lifecycle",
    task: {
      text: `Follow up with ${lead.full_name || "this lead"} about their incomplete qualification.`,
      date: nowIso.slice(0, 10),
    },
    qualification: {
      status: "qualification_stale",
      sessionId: session.id,
      formId: session.form_id,
      formVersionId: session.form_version_id,
      staleAt: session.stale_at,
      expiresAt: session.expires_at,
      experimentKey: session.experiment_key,
      variantKey: session.variant_key,
    },
    attribution: {
      source_path: session.source_path,
      landing_path: session.landing_path,
      referrer: session.referrer,
      utm_source: session.utm_source,
      utm_medium: session.utm_medium,
      utm_campaign: session.utm_campaign,
      utm_term: session.utm_term,
      utm_content: session.utm_content,
      source_page_id: session.source_page_id,
      source_page_slug: session.source_page_slug,
      source_block_id: session.source_block_id,
      source_cta_tracking_name: session.source_cta_tracking_name,
      target_keyword: session.target_keyword,
      experiment_key: session.experiment_key,
      variant_key: session.variant_key,
    },
  };
}

function isDuplicateDedupeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" ||
    String(record.message ?? "")
      .toLowerCase()
      .includes("duplicate")
  );
}

function lifecycleErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Qualification lifecycle job failed.";
}
