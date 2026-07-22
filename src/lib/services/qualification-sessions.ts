import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildQuestionSnapshots,
  type QualificationFormDefinition,
  type QualificationQuestion,
  type QualificationQuestionSnapshot,
} from "@/lib/qualification/forms";
import {
  deriveQualificationScore,
  INVEST_ROLE,
  investFormOptions,
  type ScoreResult,
} from "@/lib/qualification/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";
import {
  getQualificationFormVersion,
  type QualificationPublishedVersion,
} from "./qualification-forms";

type QualificationSessionRow = Tables<"qualification_sessions">;
type QualificationAnswerRow = Tables<"qualification_answers">;
type LeadRow = Tables<"lead_submissions">;
type QualificationSessionsClient = Pick<SupabaseClient<Database>, "from">;
type QualificationAnswerInsert =
  Database["public"]["Tables"]["qualification_answers"]["Insert"];
type QualificationAnswerUpdate =
  Database["public"]["Tables"]["qualification_answers"]["Update"];
type QualificationSessionUpdate =
  Database["public"]["Tables"]["qualification_sessions"]["Update"];
type LeadUpdate = Database["public"]["Tables"]["lead_submissions"]["Update"];
type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];

type ServiceDeps = {
  client?: QualificationSessionsClient;
  now?: () => Date;
};

export type LoadQualificationSessionInput = {
  sessionToken: string;
};

export type SaveQualificationAnswerInput = {
  sessionToken: string;
  questionId: string;
  answerValue: unknown;
};

export type CompleteQualificationSessionInput = {
  sessionToken: string;
  userAgent?: string | null;
};

export type QualificationSessionUnavailable = {
  status: "unavailable";
  reason: "not_found" | "expired";
};

export type QualificationSessionView = {
  status: "active" | "completed";
  sessionId: string;
  formId: string;
  formVersionId: string;
  formVersionNumber: number;
  questions: QualificationQuestionSnapshot[];
  currentQuestionId: string | null;
  answers: Record<string, Json>;
  completedAt: string | null;
  redirectPath: string;
};

export type SaveQualificationAnswerResult = {
  status: "saved";
  sessionId: string;
  questionId: string;
  currentQuestionId: string | null;
  answerCount: number;
};

export type CompleteQualificationSessionResult = {
  status: "completed";
  sessionId: string;
  redirectPath: string;
};

export class QualificationSessionValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("Invalid qualification session");
    this.name = "QualificationSessionValidationError";
    this.fieldErrors = fieldErrors;
  }
}

class QualificationSessionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationSessionServiceError";
  }
}

const SESSION_FIELDS =
  "id,lead_submission_id,form_id,form_version_id,session_token_hash,status,completion_redirect_path,source_path,landing_path,referrer,user_agent,utm_source,utm_medium,utm_campaign,utm_term,utm_content,source_page_id,source_page_slug,source_block_id,source_cta_tracking_name,target_keyword,experiment_key,variant_key,current_question_id,answer_count,normalized_summary,consent_accepted_at,consent_question_snapshot,consent_user_agent,consent_source_attribution,stale_at,expires_at,started_at,completed_at,created_at,updated_at" as const;
const ANSWER_FIELDS =
  "id,session_id,lead_submission_id,form_version_id,question_id,question_type,normalized_role,question_snapshot,option_snapshots,answer_value,normalized_value,answered_at,created_at,updated_at" as const;
const LEAD_FIELDS =
  "id,full_name,email,phone,close_lead_id,close_contact_id,qualification_summary,lifecycle_status" as const;

export async function loadQualificationSessionForToken(
  input: LoadQualificationSessionInput,
  deps: ServiceDeps = {},
): Promise<QualificationSessionView | QualificationSessionUnavailable> {
  const client = serviceClient(deps);
  const now = deps.now?.() ?? new Date();
  const session = await getSessionByToken(client, input.sessionToken);
  if (!session) return { status: "unavailable", reason: "not_found" };
  if (isExpired(session, now)) {
    return { status: "unavailable", reason: "expired" };
  }

  const context = await loadContext(client, session);
  return mapSessionView(context);
}

export async function saveQualificationAnswer(
  input: SaveQualificationAnswerInput,
  deps: ServiceDeps = {},
): Promise<SaveQualificationAnswerResult> {
  const client = serviceClient(deps);
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const session = await requireActiveSession(client, input.sessionToken, now);
  const context = await loadContext(client, session);
  const question = findQuestion(context.formVersion.schema, input.questionId);
  if (!question) {
    throw new QualificationSessionValidationError({
      [input.questionId]: ["Question was not found."],
    });
  }

  const answer = serializeAnswer(question, input.answerValue, nowIso);
  const existing = context.answers.find(
    (row) => row.question_id === question.id,
  );
  if (existing) {
    await updateAnswer(client, existing.id, {
      question_type: answer.questionType,
      normalized_role: answer.normalizedRole,
      question_snapshot: answer.questionSnapshot as Json,
      option_snapshots: answer.optionSnapshots as Json,
      answer_value: answer.answerValue,
      normalized_value: answer.normalizedValue,
      answered_at: nowIso,
    });
  } else {
    await insertAnswer(client, {
      session_id: session.id,
      lead_submission_id: session.lead_submission_id,
      form_version_id: session.form_version_id,
      question_id: question.id,
      question_type: answer.questionType,
      normalized_role: answer.normalizedRole,
      question_snapshot: answer.questionSnapshot as Json,
      option_snapshots: answer.optionSnapshots as Json,
      answer_value: answer.answerValue,
      normalized_value: answer.normalizedValue,
      answered_at: nowIso,
    });
  }

  const answers = await listAnswers(client, session.id);
  const nextQuestionId = firstUnansweredRequiredQuestion(
    context.formVersion.schema,
    answers,
  );
  await updateSession(client, session.id, {
    status: session.status === "completed" ? "completed" : "in_progress",
    answer_count: answers.length,
    current_question_id: nextQuestionId,
    started_at: session.started_at ?? nowIso,
  });

  return {
    status: "saved",
    sessionId: session.id,
    questionId: question.id,
    currentQuestionId: nextQuestionId,
    answerCount: answers.length,
  };
}

export async function completeQualificationSession(
  input: CompleteQualificationSessionInput,
  deps: ServiceDeps = {},
): Promise<CompleteQualificationSessionResult> {
  const client = serviceClient(deps);
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const session = await requireActiveSession(client, input.sessionToken, now);
  const context = await loadContext(client, session);
  const redirectPath = safeCompletionRedirect(session.completion_redirect_path);

  if (session.status === "completed") {
    return { status: "completed", sessionId: session.id, redirectPath };
  }

  const fieldErrors = completionFieldErrors(context);
  if (Object.keys(fieldErrors).length) {
    throw new QualificationSessionValidationError(fieldErrors);
  }

  const normalizedSummary = buildNormalizedSummary(context.answers);
  // Score the two qualifying answers (timeline + invest) against the session's
  // A/B variant. Returns null for non-scoring forms, which then flow through
  // untouched with their author-configured redirect.
  const score = deriveQualificationScore(
    normalizedSummary as Record<string, unknown>,
    session.variant_key,
  );
  const leadSummary = score
    ? {
        ...(normalizedSummary as Record<string, Json>),
        qualification_score: score.total,
        qualification_band: score.band,
        qualification_thank_you_state: score.thankYouState,
      }
    : normalizedSummary;
  const consentAnswer = consentAnswerFor(context);
  await updateSession(client, session.id, {
    status: "completed",
    completed_at: nowIso,
    current_question_id: null,
    answer_count: context.answers.length,
    normalized_summary: normalizedSummary,
    consent_accepted_at: consentAnswer ? nowIso : null,
    consent_question_snapshot: (consentAnswer?.question_snapshot ??
      null) as Json | null,
    consent_user_agent: input.userAgent ?? null,
  });
  await updateLead(client, session.lead_submission_id, {
    lifecycle_status: "qualified",
    latest_qualification_completed_at: nowIso,
    qualification_summary: leadSummary,
    close_sync_status: "pending",
    close_sync_next_retry_at: nowIso,
  });

  const lead = await getLead(client, session.lead_submission_id);
  await enqueueQualificationEnrichment(client, {
    session,
    formVersion: context.formVersion,
    answers: context.answers,
    normalizedSummary,
    score,
    lead,
    nowIso,
  });

  return {
    status: "completed",
    sessionId: session.id,
    redirectPath: completionRedirectFor(score, redirectPath),
  };
}

/**
 * Scored sessions land on the fit-based thank-you screen (which then routes to
 * booking or the downsell asset); non-scoring forms keep their author-configured
 * completion redirect.
 */
function completionRedirectFor(
  score: ScoreResult | null,
  fallback: string,
): string {
  if (!score) return fallback;
  const params = new URLSearchParams({
    state: score.thankYouState,
    score: String(score.total),
  });
  return `/thank-you?${params.toString()}`;
}

function hashQualificationSessionToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

function safeCompletionRedirect(path: string | null | undefined) {
  if (!path) return "/thank-you";
  if (!path.startsWith("/") || path.startsWith("//")) return "/thank-you";
  return path;
}

function serviceClient(deps: ServiceDeps) {
  return deps.client ?? createAdminClient();
}

async function requireActiveSession(
  client: QualificationSessionsClient,
  sessionToken: string,
  now: Date,
) {
  const session = await getSessionByToken(client, sessionToken);
  if (!session) {
    throw new QualificationSessionValidationError({
      session: ["Qualification session was not found."],
    });
  }
  if (isExpired(session, now)) {
    throw new QualificationSessionValidationError({
      session: ["Qualification session has expired."],
    });
  }
  return session;
}

async function getSessionByToken(
  client: QualificationSessionsClient,
  token: string,
) {
  const { data, error } = await client
    .from("qualification_sessions")
    .select(SESSION_FIELDS)
    .eq("session_token_hash", hashQualificationSessionToken(token))
    .maybeSingle();

  if (error) {
    throw new QualificationSessionServiceError(
      "Could not load qualification session.",
    );
  }
  return data as QualificationSessionRow | null;
}

async function loadContext(
  client: QualificationSessionsClient,
  session: QualificationSessionRow,
) {
  const [rawFormVersion, answers] = await Promise.all([
    getQualificationFormVersion(
      { versionId: session.form_version_id },
      { client },
    ),
    listAnswers(client, session.id),
  ]);

  const formVersion = applyInvestVariant(rawFormVersion, session.variant_key);
  return { session, formVersion, answers };
}

/**
 * Swaps the invest question's options for the session's assigned A/B variant.
 * The form is seeded with Variant A options; a B-variant session should see the
 * Variant B "capital posture" options instead. Applied once at load so every
 * downstream reader (view, answer save, validation, normalization) is
 * variant-consistent. Non-invest forms are returned untouched.
 */
function applyInvestVariant(
  formVersion: QualificationPublishedVersion,
  variantKey: string | null,
): QualificationPublishedVersion {
  if (variantKey !== "A" && variantKey !== "B") return formVersion;
  let swapped = false;
  const questions = formVersion.schema.questions.map((question) => {
    if (
      question.normalizedRole !== INVEST_ROLE ||
      question.type !== "single_choice"
    ) {
      return question;
    }
    swapped = true;
    return { ...question, options: investFormOptions(variantKey) };
  });
  if (!swapped) return formVersion;
  return {
    ...formVersion,
    schema: { ...formVersion.schema, questions },
  };
}

async function listAnswers(
  client: QualificationSessionsClient,
  sessionId: string,
) {
  const { data, error } = await client
    .from("qualification_answers")
    .select(ANSWER_FIELDS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new QualificationSessionServiceError(
      "Could not load qualification answers.",
    );
  }
  return (data ?? []) as QualificationAnswerRow[];
}

async function insertAnswer(
  client: QualificationSessionsClient,
  row: QualificationAnswerInsert,
) {
  const { error } = await client
    .from("qualification_answers")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    throw new QualificationSessionServiceError(
      "Could not save qualification answer.",
    );
  }
}

async function updateAnswer(
  client: QualificationSessionsClient,
  answerId: string,
  patch: QualificationAnswerUpdate,
) {
  const { error } = await client
    .from("qualification_answers")
    .update(patch)
    .eq("id", answerId);
  if (error) {
    throw new QualificationSessionServiceError(
      "Could not update qualification answer.",
    );
  }
}

async function updateSession(
  client: QualificationSessionsClient,
  sessionId: string,
  patch: QualificationSessionUpdate,
) {
  const { error } = await client
    .from("qualification_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) {
    throw new QualificationSessionServiceError(
      "Could not update qualification session.",
    );
  }
}

async function updateLead(
  client: QualificationSessionsClient,
  leadId: string,
  patch: LeadUpdate,
) {
  const { error } = await client
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId);
  if (error) {
    throw new QualificationSessionServiceError(
      "Could not update lead qualification state.",
    );
  }
}

async function getLead(client: QualificationSessionsClient, leadId: string) {
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .eq("id", leadId)
    .single();
  if (error || !data) return null;
  return data as LeadRow;
}

async function enqueueQualificationEnrichment(
  client: QualificationSessionsClient,
  {
    session,
    formVersion,
    answers,
    normalizedSummary,
    score,
    lead,
    nowIso,
  }: {
    session: QualificationSessionRow;
    formVersion: QualificationPublishedVersion;
    answers: QualificationAnswerRow[];
    normalizedSummary: Json;
    score: ScoreResult | null;
    lead: LeadRow | null;
    nowIso: string;
  },
) {
  const event: CloseSyncEventInsert = {
    lead_submission_id: session.lead_submission_id,
    session_id: session.id,
    event_type: "qualification_enrichment",
    status: "pending",
    dedupe_key: `qualification_enrichment:${session.id}`,
    next_retry_at: nowIso,
    close_lead_id: lead?.close_lead_id ?? null,
    close_contact_id: lead?.close_contact_id ?? null,
    payload: {
      source: "qualification_completion",
      qualification: {
        status: "qualified",
        sessionId: session.id,
        formId: formVersion.formId,
        formVersionId: formVersion.versionId,
        completedAt: nowIso,
        experimentKey: session.experiment_key,
        variantKey: session.variant_key,
        score: score ? score.total : null,
        band: score ? score.band : null,
        thankYouState: score ? score.thankYouState : null,
        disqualified: score ? score.disqualified : null,
      },
      attribution: sourceAttributionFor(session),
      normalized: normalizedSummary,
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
  if (error) {
    throw new QualificationSessionServiceError(
      "Qualification completed but Close enrichment was not queued.",
    );
  }
}

function mapSessionView({
  session,
  formVersion,
  answers,
}: {
  session: QualificationSessionRow;
  formVersion: QualificationPublishedVersion;
  answers: QualificationAnswerRow[];
}): QualificationSessionView {
  return {
    status: session.status === "completed" ? "completed" : "active",
    sessionId: session.id,
    formId: session.form_id,
    formVersionId: session.form_version_id,
    formVersionNumber: formVersion.versionNumber,
    questions: buildQuestionSnapshots(formVersion.schema),
    currentQuestionId:
      session.status === "completed"
        ? null
        : firstUnansweredRequiredQuestion(formVersion.schema, answers),
    answers: Object.fromEntries(
      answers.map((answer) => [answer.question_id, answer.answer_value]),
    ),
    completedAt: session.completed_at,
    redirectPath: safeCompletionRedirect(session.completion_redirect_path),
  };
}

function serializeAnswer(
  question: QualificationQuestion,
  value: unknown,
  answeredAt: string,
) {
  const snapshot = buildQuestionSnapshots({
    version: 1,
    questions: [question],
  })[0];
  const normalizedValue = normalizedValueForQuestion(question, value);
  return {
    questionType: question.type,
    normalizedRole: question.normalizedRole ?? null,
    questionSnapshot: snapshot,
    optionSnapshots: optionSnapshotsFor(question, value),
    answerValue: answerValueForStorage(value),
    normalizedValue,
    answeredAt,
  };
}

function findQuestion(form: QualificationFormDefinition, questionId: string) {
  return form.questions.find((question) => question.id === questionId) ?? null;
}

function firstUnansweredRequiredQuestion(
  form: QualificationFormDefinition,
  answers: QualificationAnswerRow[],
) {
  const byQuestion = new Map(
    answers.map((answer) => [answer.question_id, answer]),
  );
  return (
    form.questions.find(
      (question) =>
        question.required &&
        !answerSatisfiesRequiredQuestion(question, byQuestion.get(question.id)),
    )?.id ?? null
  );
}

function completionFieldErrors({
  formVersion,
  answers,
}: {
  formVersion: QualificationPublishedVersion;
  answers: QualificationAnswerRow[];
}) {
  const byQuestion = new Map(
    answers.map((answer) => [answer.question_id, answer]),
  );
  const fieldErrors: Record<string, string[]> = {};

  for (const question of formVersion.schema.questions) {
    const answer = byQuestion.get(question.id);
    if (question.type === "consent" && question.required) {
      if (answer?.answer_value !== true) {
        fieldErrors[question.id] = ["Consent is required."];
      }
      continue;
    }
    if (
      question.required &&
      !answerSatisfiesRequiredQuestion(question, answer)
    ) {
      fieldErrors[question.id] = [`${question.label} is required.`];
    }
  }
  return fieldErrors;
}

function answerSatisfiesRequiredQuestion(
  question: QualificationQuestion,
  answer: QualificationAnswerRow | undefined,
) {
  if (!answer) return false;
  if (question.type === "consent") return answer.answer_value === true;
  return answerHasValue(answer.answer_value);
}

function answerHasValue(value: Json): boolean {
  if (value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((item) => answerHasValue(item));
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function consentAnswerFor({
  formVersion,
  answers,
}: {
  formVersion: QualificationPublishedVersion;
  answers: QualificationAnswerRow[];
}) {
  const consentQuestion = formVersion.schema.questions.find(
    (question) => question.type === "consent" && question.required,
  );
  if (!consentQuestion) return null;
  return (
    answers.find((answer) => answer.question_id === consentQuestion.id) ?? null
  );
}

function buildNormalizedSummary(answers: QualificationAnswerRow[]): Json {
  return answers.reduce<Record<string, Json>>((summary, answer) => {
    if (!answer.normalized_role) return summary;
    if (
      answer.normalized_value &&
      typeof answer.normalized_value === "object" &&
      !Array.isArray(answer.normalized_value)
    ) {
      const normalized = answer.normalized_value as Record<string, Json>;
      summary[answer.normalized_role] =
        normalized[answer.normalized_role] ?? answer.answer_value;
    } else {
      summary[answer.normalized_role] = answer.answer_value;
    }
    return summary;
  }, {});
}

function normalizedValueForQuestion(
  question: QualificationQuestion,
  value: unknown,
): Json {
  if (!question.normalizedRole) return {};
  return {
    [question.normalizedRole]: normalizedScalarForQuestion(question, value),
  };
}

function normalizedScalarForQuestion(
  question: QualificationQuestion,
  value: unknown,
): Json {
  if (question.type === "consent") return value === true;
  const option = optionForValue(question, value);
  if (option) return option.value ?? option.id;
  return answerValueForStorage(value);
}

function optionSnapshotsFor(
  question: QualificationQuestion,
  value: unknown,
): Json {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => optionForValue(question, item))
    .filter((option): option is NonNullable<typeof option> => Boolean(option))
    .map((option) => ({
      id: option.id,
      label: option.label,
      ...(option.value ? { value: option.value } : {}),
    }));
}

function optionForValue(question: QualificationQuestion, value: unknown) {
  const text = String(value);
  return (
    question.options?.find(
      (option) => option.id === text || option.value === text,
    ) ?? null
  );
}

function answerValueForStorage(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => answerValueForStorage(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        answerValueForStorage(item),
      ]),
    ) as Json;
  }
  return String(value);
}

function sourceAttributionFor(session: QualificationSessionRow): Json {
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
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "Question";
  }
  const label = (snapshot as Record<string, Json>).label;
  return typeof label === "string" ? label : "Question";
}

function answerValueForNote(value: Json) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isExpired(session: QualificationSessionRow, now: Date) {
  return new Date(session.expires_at).getTime() <= now.getTime();
}
