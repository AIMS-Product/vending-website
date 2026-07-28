import "server-only";

import { VP_QUESTION_IDS } from "@/lib/qualification/vp-fields";
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

/**
 * Stage 2: save the timeline/invest answers against the session the token
 * points at, then complete it (scores, sets the lead's band, queues Close
 * enrichment). The token is the only identifier — a lead id from the browser
 * would let anyone post answers against someone else's lead.
 */
export async function finishInlineQualification(
  input: FinishInlineQualificationInput,
  deps: SubmitInlineQualificationDeps = {},
): Promise<FinishInlineQualificationResult> {
  const sessionToken = requireSessionToken(input.sessionToken);
  await requireUncompletedSession(sessionToken, deps);

  await saveQualificationAnswer(
    {
      sessionToken,
      questionId: VP_QUESTION_IDS.timeline,
      answerValue: input.timeline,
    },
    deps,
  );
  await saveQualificationAnswer(
    {
      sessionToken,
      questionId: VP_QUESTION_IDS.invest,
      answerValue: input.invest,
    },
    deps,
  );

  const completed = await completeQualificationSession(
    { sessionToken, userAgent: stringOrNull(input.userAgent) },
    deps,
  );

  // deriveQualificationScore returns null when the stored timeline/invest
  // values don't match a known catalog option (e.g. a value posted outside
  // the rendered <select>, bypassing the UI). completeQualificationSession
  // has already required both fields be present and non-blank, so a null
  // score here means the value was present but unrecognised — surface that
  // as a validation error rather than silently returning a "completed"
  // result with no fit for the UI to render.
  if (completed.thankYouState == null || completed.score == null) {
    throw new QualificationSessionValidationError({
      timeline: ["Select a valid answer and try again."],
      invest: ["Select a valid answer and try again."],
    });
  }

  return {
    status: "completed",
    leadId: completed.leadSubmissionId,
    thankYouState: completed.thankYouState,
    score: completed.score,
  };
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
 * from the first pass.
 */
async function requireUncompletedSession(
  sessionToken: string,
  deps: SubmitInlineQualificationDeps,
) {
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
}

function isConsentGiven(value: unknown): boolean {
  return value === true || value === "true";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
