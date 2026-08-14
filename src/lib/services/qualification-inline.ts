import "server-only";

import {
  VP_BOTTLENECK_FIELD_OPTIONS,
  VP_CONFIDENCE_FIELD_OPTIONS,
  VP_INVEST_FIELD_OPTIONS,
  VP_OPERATOR_FIELD_OPTIONS,
  VP_PERSONA_FIELD_OPTIONS,
  VP_QUESTION_IDS,
  VP_TIMELINE_FIELD_OPTIONS,
  type VpFieldOption,
} from "@/lib/qualification/vp-fields";
import type { ThankYouStateKey } from "@/lib/qualification/scoring";
import {
  createQualificationIntakeSession,
  QualificationIntakeValidationError,
  type CreateQualificationIntakeDeps,
  type CreateQualificationIntakeInput,
} from "./qualification-intake";
import {
  completeQualificationSession,
  loadQualificationSessionForToken,
  saveQualificationAnswer,
  QualificationSessionValidationError,
  type QualificationSessionView,
} from "./qualification-sessions";

export {
  QualificationIntakeValidationError,
  QualificationSessionValidationError,
};

export type SubmitInlineQualificationDeps = CreateQualificationIntakeDeps;

export type StartInlineQualificationInput = Omit<
  CreateQualificationIntakeInput,
  "variantKey"
> & {
  consentUpdates: unknown;
  consentContact: unknown;
};

export type SubmitInlineQualificationInput = StartInlineQualificationInput & {
  timeline: unknown;
  invest: unknown;
  // Form V2 fields. Optional so one-shot callers that still collect only
  // timeline + invest (page-builder embeds, /vp-quiz) keep working unchanged.
  operator?: unknown;
  persona?: unknown;
  confidence?: unknown;
  bottleneck?: unknown;
};

export type StartInlineQualificationResult = {
  status: "started";
  leadId: string;
  // The raw session token. It goes to the browser so stage 2 can post it back;
  // see the spec's "The session token" section — the standalone
  // /qualify/[sessionToken] route already puts the same value in the URL bar.
  sessionToken: string;
};

export type FinishInlineQualificationInput = {
  sessionToken: unknown;
  timeline: unknown;
  invest: unknown;
  // Form V2 fields (Kody, 2026-08-14). `operator` is the gate: "yes" routes
  // through the Operator path (bottleneck + invest), "no" through the
  // Standard path (persona + confidence + timeline + invest). Absent/blank
  // keeps the legacy two-question contract for older callers.
  operator?: unknown;
  persona?: unknown;
  confidence?: unknown;
  bottleneck?: unknown;
  userAgent?: unknown;
};

export type SubmitInlineQualificationResult = {
  status: "completed";
  leadId: string;
  thankYouState: ThankYouStateKey;
  score: number;
};

export type FinishInlineQualificationResult = SubmitInlineQualificationResult;

/**
 * Stage 1 of the inline /contact funnel: create the intake session (forcing
 * Variant A — A/B is retired for this funnel) and save both consents. The lead
 * is persisted and contactable when this resolves, whether or not the visitor
 * ever answers the qualifying questions.
 *
 * Pure composition over the existing intake/session services — no new
 * persistence, scoring, or Close-sync logic lives here.
 */
export async function startInlineQualification(
  input: StartInlineQualificationInput,
  deps: SubmitInlineQualificationDeps = {},
): Promise<StartInlineQualificationResult> {
  // Consent is the whole reason these two checkboxes sit in stage 1: it is
  // what makes the person contactable. Refuse before anything is written
  // rather than capturing a lead we have no permission to call.
  requireConsents(input);

  const intake = await createQualificationIntakeSession(
    { ...input, variantKey: "A" },
    deps,
  );

  await saveQualificationAnswer(
    {
      sessionToken: intake.sessionToken,
      questionId: VP_QUESTION_IDS.consentUpdates,
      answerValue: isConsentGiven(input.consentUpdates),
    },
    deps,
  );
  await saveQualificationAnswer(
    {
      sessionToken: intake.sessionToken,
      questionId: VP_QUESTION_IDS.consentContact,
      answerValue: isConsentGiven(input.consentContact),
    },
    deps,
  );

  return {
    status: "started",
    leadId: intake.leadId,
    sessionToken: intake.sessionToken,
  };
}

// Which questions each Form V2 path answers (beyond the gate itself), in
// presentation order, with the option catalog each answer must come from.
const VP_ANSWER_CATALOGS: Record<string, readonly VpFieldOption[]> = {
  [VP_QUESTION_IDS.operator]: VP_OPERATOR_FIELD_OPTIONS,
  [VP_QUESTION_IDS.persona]: VP_PERSONA_FIELD_OPTIONS,
  [VP_QUESTION_IDS.confidence]: VP_CONFIDENCE_FIELD_OPTIONS,
  [VP_QUESTION_IDS.bottleneck]: VP_BOTTLENECK_FIELD_OPTIONS,
  [VP_QUESTION_IDS.timeline]: VP_TIMELINE_FIELD_OPTIONS,
  [VP_QUESTION_IDS.invest]: VP_INVEST_FIELD_OPTIONS,
};

const VP_OPERATOR_PATH_QUESTIONS = [
  VP_QUESTION_IDS.bottleneck,
  VP_QUESTION_IDS.invest,
] as const;

const VP_STANDARD_PATH_QUESTIONS = [
  VP_QUESTION_IDS.persona,
  VP_QUESTION_IDS.confidence,
  VP_QUESTION_IDS.timeline,
  VP_QUESTION_IDS.invest,
] as const;

// The pre-gate contract: callers that never send the gate answer (page-builder
// one-shot embeds, /vp-quiz) still submit exactly timeline + invest.
const VP_LEGACY_QUESTIONS = [
  VP_QUESTION_IDS.timeline,
  VP_QUESTION_IDS.invest,
] as const;

/**
 * Stage 2: save the answers for the visitor's path against the session the
 * token points at, then complete it (scores, sets the lead's band, queues
 * Close enrichment). The token is the only identifier — a lead id from the
 * browser would let anyone post answers against someone else's lead.
 *
 * The gate answer picks the path: "yes" → Operator (bottleneck + invest,
 * urgency comes from the gate), "no" → Standard (persona + confidence +
 * timeline + invest). No gate answer keeps the legacy timeline + invest
 * contract so pre-V2 callers are untouched.
 */
export async function finishInlineQualification(
  input: FinishInlineQualificationInput,
  deps: SubmitInlineQualificationDeps = {},
): Promise<FinishInlineQualificationResult> {
  const sessionToken = requireSessionToken(input.sessionToken);
  const session = await requireUncompletedSession(sessionToken, deps);

  const questionIds = answeredQuestionIdsFor(input, session);

  const fieldErrors: Record<string, string[]> = {};
  const answers: Array<{ questionId: string; answerValue: string }> = [];
  for (const questionId of questionIds) {
    const value = answerValueFor(input, questionId);
    const catalog = VP_ANSWER_CATALOGS[questionId];
    if (
      typeof value === "string" &&
      catalog.some((option) => option.value === value)
    ) {
      answers.push({ questionId, answerValue: value });
    } else {
      fieldErrors[questionId] = ["Select an answer."];
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw new QualificationSessionValidationError(fieldErrors);
  }

  for (const answer of answers) {
    await saveQualificationAnswer({ sessionToken, ...answer }, deps);
  }

  const completed = await completeQualificationSession(
    { sessionToken, userAgent: stringOrNull(input.userAgent) },
    deps,
  );

  // deriveQualificationScore returns null when the stored timeline/invest
  // values don't match a known catalog option (e.g. a value posted outside
  // the rendered options, bypassing the UI). The catalog check above has
  // already required every planned answer, so a null score here means a
  // stored value was present but unrecognised — surface that as a validation
  // error rather than silently returning a "completed" result with no fit
  // for the UI to render.
  if (completed.thankYouState == null || completed.score == null) {
    throw new QualificationSessionValidationError(
      Object.fromEntries(
        questionIds
          .filter(
            (id) =>
              id === VP_QUESTION_IDS.timeline || id === VP_QUESTION_IDS.invest,
          )
          .map((id) => [id, ["Select a valid answer and try again."]]),
      ),
    );
  }

  return {
    status: "completed",
    leadId: completed.leadSubmissionId,
    thankYouState: completed.thankYouState,
    score: completed.score,
  };
}

/**
 * Resolves which question ids this submission must answer. Path questions are
 * only planned when the session's form version actually contains the gate
 * question — a session started against the pre-V2 published schema cannot
 * store gate/persona/confidence/bottleneck answers, so a gate submission
 * against one is told to refresh (restarting lands on the new version) rather
 * than failing on fields its form can never accept.
 */
function answeredQuestionIdsFor(
  input: FinishInlineQualificationInput,
  session: QualificationSessionView,
): readonly string[] {
  const operator = stringOrNull(input.operator);
  if (operator == null) return VP_LEGACY_QUESTIONS;

  const formQuestionIds = new Set(
    session.questions.map((question) => question.id),
  );
  if (!formQuestionIds.has(VP_QUESTION_IDS.operator)) {
    throw new QualificationSessionValidationError({
      session: ["This form was just updated."],
    });
  }

  const pathQuestions =
    operator === "yes"
      ? VP_OPERATOR_PATH_QUESTIONS
      : VP_STANDARD_PATH_QUESTIONS;
  return [VP_QUESTION_IDS.operator, ...pathQuestions];
}

function answerValueFor(
  input: FinishInlineQualificationInput,
  questionId: string,
): unknown {
  switch (questionId) {
    case VP_QUESTION_IDS.operator:
      return input.operator;
    case VP_QUESTION_IDS.persona:
      return input.persona;
    case VP_QUESTION_IDS.confidence:
      return input.confidence;
    case VP_QUESTION_IDS.bottleneck:
      return input.bottleneck;
    case VP_QUESTION_IDS.timeline:
      return input.timeline;
    case VP_QUESTION_IDS.invest:
      return input.invest;
    default:
      return undefined;
  }
}

/**
 * The one-shot path: everything in a single submit. Kept as `start` then
 * `finish` so it cannot drift from the staged path — its tests are the
 * regression net for that split. Used by callers that collect all six fields
 * at once (page-builder embeds, /vp-quiz).
 */
export async function submitInlineQualification(
  input: SubmitInlineQualificationInput,
  deps: SubmitInlineQualificationDeps = {},
): Promise<SubmitInlineQualificationResult> {
  const started = await startInlineQualification(input, deps);
  return finishInlineQualification(
    {
      sessionToken: started.sessionToken,
      timeline: input.timeline,
      invest: input.invest,
      operator: input.operator,
      persona: input.persona,
      confidence: input.confidence,
      bottleneck: input.bottleneck,
      userAgent: input.userAgent,
    },
    deps,
  );
}

function requireConsents(input: StartInlineQualificationInput) {
  const fieldErrors: Record<string, string[]> = {};
  if (!isConsentGiven(input.consentUpdates)) {
    fieldErrors[VP_QUESTION_IDS.consentUpdates] = ["Consent is required."];
  }
  if (!isConsentGiven(input.consentContact)) {
    fieldErrors[VP_QUESTION_IDS.consentContact] = ["Consent is required."];
  }
  if (Object.keys(fieldErrors).length) {
    throw new QualificationSessionValidationError(fieldErrors);
  }
}

function requireSessionToken(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new QualificationSessionValidationError({
    session: ["Qualification session was not found."],
  });
}

/**
 * Guards a repeat stage-2 submit. `completeQualificationSession` answers a
 * second completion from the stored summary, so without this the newly saved
 * answers would overwrite the old ones while the returned score still came
 * from the first pass. Returns the loaded view so the caller can plan the
 * submission against the session's actual form version.
 */
async function requireUncompletedSession(
  sessionToken: string,
  deps: SubmitInlineQualificationDeps,
): Promise<QualificationSessionView> {
  const session = await loadQualificationSessionForToken(
    { sessionToken },
    deps,
  );
  if (session.status === "unavailable") {
    throw new QualificationSessionValidationError({
      session: ["Qualification session was not found."],
    });
  }
  if (session.status === "completed") {
    throw new QualificationSessionValidationError({
      session: ["This form has already been submitted."],
    });
  }
  return session;
}

function isConsentGiven(value: unknown): boolean {
  return value === true || value === "true";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
