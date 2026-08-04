import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDuplicateDedupeError } from "@/lib/close/dedupe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";
import {
  buildNormalizedSummary,
  hashQualificationSessionToken,
  QualificationSessionValidationError,
} from "./qualification-sessions";

type SessionRow = Tables<"qualification_sessions">;
type AnswerRow = Tables<"qualification_answers">;
type NewsletterClient = Pick<SupabaseClient<Database>, "from">;
type SessionUpdate =
  Database["public"]["Tables"]["qualification_sessions"]["Update"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];
type EventInsert = Database["public"]["Tables"]["close_sync_events"]["Insert"];

type ServiceDeps = {
  client?: NewsletterClient;
  now?: () => Date;
};

export type NewsletterSessionInput = {
  sessionToken: string;
  newsletterFormId: string;
  requiredConsentQuestionId: string;
  userAgent?: string | null;
};

const SESSION_FIELDS =
  "id,lead_submission_id,form_id,form_version_id,session_token_hash,status,source_path,landing_path,referrer,user_agent,utm_source,utm_medium,utm_campaign,utm_term,utm_content,source_page_id,source_page_slug,source_block_id,source_cta_tracking_name,target_keyword,experiment_key,variant_key,consent_source_attribution,expires_at" as const;
const ANSWER_FIELDS =
  "id,session_id,lead_submission_id,form_version_id,question_id,question_type,normalized_role,question_snapshot,option_snapshots,answer_value,normalized_value,answered_at,created_at,updated_at" as const;

class NewsletterSessionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsletterSessionServiceError";
  }
}

/** Stage 1 is the conversion, so sync its consent even if stage 2 is skipped. */
export async function markNewsletterSubscription(
  input: Omit<NewsletterSessionInput, "userAgent">,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const context = await requireNewsletterContext(client, input, now);
  const consent = requiredConsentAnswer(context.answers, input);
  const normalized = buildNormalizedSummary(context.answers);

  await updateSession(client, context.session.id, {
    status: "in_progress",
    answer_count: context.answers.length,
    normalized_summary: normalized,
    consent_accepted_at: nowIso,
    consent_question_snapshot: consent.question_snapshot,
    consent_user_agent: context.session.user_agent,
  });
  await updateLead(client, context.session.lead_submission_id, {
    lifecycle_status: "newsletter_subscribed",
    qualification_summary: normalized,
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
  });
  await enqueueNewsletterEnrichment(client, {
    ...context,
    normalized,
    nowIso,
    phase: "subscribed",
  });

  return {
    status: "subscribed" as const,
    leadSubmissionId: context.session.lead_submission_id,
  };
}

/** Completes the optional follow-up without qualifying the subscriber. */
export async function completeNewsletterSignupSession(
  input: NewsletterSessionInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const context = await requireNewsletterContext(client, input, now);
  const consent = requiredConsentAnswer(context.answers, input);
  const normalized = buildNormalizedSummary(context.answers);

  await updateSession(client, context.session.id, {
    status: "completed",
    completed_at: nowIso,
    current_question_id: null,
    answer_count: context.answers.length,
    normalized_summary: normalized,
    consent_accepted_at: nowIso,
    consent_question_snapshot: consent.question_snapshot,
    consent_user_agent: input.userAgent ?? context.session.user_agent,
  });
  await updateLead(client, context.session.lead_submission_id, {
    lifecycle_status: "newsletter_subscribed",
    latest_qualification_completed_at: nowIso,
    qualification_summary: normalized,
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
  });
  await enqueueNewsletterEnrichment(client, {
    ...context,
    normalized,
    nowIso,
    phase: "completed",
  });

  return {
    status: "completed" as const,
    leadSubmissionId: context.session.lead_submission_id,
    thankYouState: null,
    score: null,
  };
}

async function requireNewsletterContext(
  client: NewsletterClient,
  input: Pick<NewsletterSessionInput, "sessionToken" | "newsletterFormId">,
  now: Date,
) {
  const { data, error } = await client
    .from("qualification_sessions")
    .select(SESSION_FIELDS)
    .eq("session_token_hash", hashQualificationSessionToken(input.sessionToken))
    .maybeSingle();
  if (error) {
    throw new NewsletterSessionServiceError(
      "Could not load newsletter signup session.",
    );
  }
  const session = data as SessionRow | null;
  if (!session || session.form_id !== input.newsletterFormId) {
    throw new QualificationSessionValidationError({
      session: ["Newsletter signup session was not found."],
    });
  }
  if (new Date(session.expires_at).getTime() <= now.getTime()) {
    throw new QualificationSessionValidationError({
      session: ["Newsletter signup session has expired."],
    });
  }
  if (session.status === "completed") {
    throw new QualificationSessionValidationError({
      session: ["This newsletter signup has already been completed."],
    });
  }

  const answers = await listAnswers(client, session.id);
  return { session, answers };
}

function requiredConsentAnswer(
  answers: AnswerRow[],
  input: Pick<NewsletterSessionInput, "requiredConsentQuestionId">,
) {
  const answer = answers.find(
    (candidate) => candidate.question_id === input.requiredConsentQuestionId,
  );
  if (answer?.answer_value !== true) {
    throw new QualificationSessionValidationError({
      [input.requiredConsentQuestionId]: ["Consent is required."],
    });
  }
  return answer;
}

async function listAnswers(client: NewsletterClient, sessionId: string) {
  const { data, error } = await client
    .from("qualification_answers")
    .select(ANSWER_FIELDS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new NewsletterSessionServiceError(
      "Could not load newsletter signup answers.",
    );
  }
  return (data ?? []) as AnswerRow[];
}

async function updateSession(
  client: NewsletterClient,
  sessionId: string,
  patch: SessionUpdate,
) {
  const { error } = await client
    .from("qualification_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) {
    throw new NewsletterSessionServiceError(
      "Could not update newsletter signup session.",
    );
  }
}

async function updateLead(
  client: NewsletterClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);
  if (error) {
    throw new NewsletterSessionServiceError(
      "Could not update newsletter subscriber.",
    );
  }
}

async function enqueueNewsletterEnrichment(
  client: NewsletterClient,
  {
    session,
    answers,
    normalized,
    nowIso,
    phase,
  }: {
    session: SessionRow;
    answers: AnswerRow[];
    normalized: Json;
    nowIso: string;
    phase: "subscribed" | "completed";
  },
) {
  const event: EventInsert = {
    lead_submission_id: session.lead_submission_id,
    session_id: session.id,
    event_type: "newsletter_enrichment",
    status: "pending",
    dedupe_key: `newsletter_enrichment:${session.id}:${phase}`,
    next_retry_at: nowIso,
    payload: {
      source: "newsletter_signup",
      qualification: {
        status: "newsletter_subscribed",
        phase,
        sessionId: session.id,
        formId: session.form_id,
        formVersionId: session.form_version_id,
        completedAt: phase === "completed" ? nowIso : null,
      },
      attribution: sourceAttributionFor(session),
      normalized,
      answers: answers.map((answer) => ({
        questionId: answer.question_id,
        questionType: answer.question_type,
        normalizedRole: answer.normalized_role,
        label: questionLabel(answer.question_snapshot),
        value: answerValueForNote(answer.answer_value),
        normalizedValue: answer.normalized_value,
      })),
    } satisfies Json,
  };
  const { error } = await client
    .from("close_sync_events")
    .insert(event)
    .select("id")
    .single();
  if (error && !isDuplicateDedupeError(error)) {
    throw new NewsletterSessionServiceError(
      "Newsletter signup was saved but Close enrichment was not queued.",
    );
  }
}

function sourceAttributionFor(session: SessionRow): Json {
  return {
    ...jsonObject(session.consent_source_attribution),
    source_path: session.source_path,
    landing_path: session.landing_path,
    referrer: session.referrer,
    source_page_id: session.source_page_id,
    source_page_slug: session.source_page_slug,
    source_block_id: session.source_block_id,
    source_cta_tracking_name: session.source_cta_tracking_name,
    target_keyword: session.target_keyword,
    user_agent: session.user_agent,
    utm_source: session.utm_source,
    utm_medium: session.utm_medium,
    utm_campaign: session.utm_campaign,
    utm_term: session.utm_term,
    utm_content: session.utm_content,
    experiment_key: session.experiment_key,
    variant_key: session.variant_key,
  };
}

function jsonObject(value: Json): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Json>;
}

function questionLabel(snapshot: Json) {
  const label = jsonObject(snapshot).label;
  return typeof label === "string" ? label : "Question";
}

function answerValueForNote(value: Json) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
