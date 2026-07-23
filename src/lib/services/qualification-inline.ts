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
  saveQualificationAnswer,
  QualificationSessionValidationError,
} from "./qualification-sessions";

export {
  QualificationIntakeValidationError,
  QualificationSessionValidationError,
};

export type SubmitInlineQualificationDeps = CreateQualificationIntakeDeps;

export type SubmitInlineQualificationInput = Omit<
  CreateQualificationIntakeInput,
  "variantKey"
> & {
  consentUpdates: unknown;
  consentContact: unknown;
  timeline: unknown;
  invest: unknown;
};

export type SubmitInlineQualificationResult = {
  status: "completed";
  leadId: string;
  thankYouState: ThankYouStateKey;
  score: number;
};

/**
 * Orchestrates the inline /contact qualification funnel as one atomic
 * server-side path: create the intake session (forcing Variant A — A/B is
 * retired for this funnel), save the four required answers (both consents +
 * timeline + invest), then complete the session (scores, sets the lead's
 * band, queues Close sync). Pure composition over the existing
 * intake/session services — no new persistence, scoring, or Close-sync
 * logic lives here.
 *
 * The raw session token never leaves this function; only leadId +
 * thankYouState + score cross back to the caller. See
 * .claude/specs/2026-07-22-inline-contact-qualification.md.
 */
export async function submitInlineQualification(
  input: SubmitInlineQualificationInput,
  deps: SubmitInlineQualificationDeps = {},
): Promise<SubmitInlineQualificationResult> {
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
  await saveQualificationAnswer(
    {
      sessionToken: intake.sessionToken,
      questionId: VP_QUESTION_IDS.timeline,
      answerValue: input.timeline,
    },
    deps,
  );
  await saveQualificationAnswer(
    {
      sessionToken: intake.sessionToken,
      questionId: VP_QUESTION_IDS.invest,
      answerValue: input.invest,
    },
    deps,
  );

  const completed = await completeQualificationSession(
    {
      sessionToken: intake.sessionToken,
      userAgent: stringOrNull(input.userAgent),
    },
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
    leadId: intake.leadId,
    thankYouState: completed.thankYouState,
    score: completed.score,
  };
}

function isConsentGiven(value: unknown): boolean {
  return value === true || value === "true";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
