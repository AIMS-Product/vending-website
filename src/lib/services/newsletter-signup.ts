import "server-only";

import { z } from "zod";
import {
  NEWSLETTER_FORM_ID,
  NEWSLETTER_LEARN_OPTIONS,
  NEWSLETTER_PULL_OPTIONS,
  NEWSLETTER_QUESTION_IDS,
} from "@/lib/content/newsletter";
import { normalizePhone } from "@/lib/phone";
import {
  createQualificationIntakeSession,
  QualificationIntakeValidationError,
  type CreateQualificationIntakeDeps,
  type CreateQualificationIntakeInput,
} from "./qualification-intake";
import {
  loadQualificationSessionForToken,
  QualificationSessionValidationError,
  saveQualificationAnswer,
  updateQualificationLeadPhone,
} from "./qualification-sessions";
import {
  completeNewsletterSignupSession,
  markNewsletterSubscription,
} from "./newsletter-session-lifecycle";

export type StartNewsletterSignupInput = Omit<
  CreateQualificationIntakeInput,
  "qualificationFormId" | "qualificationFormVersionId"
> & {
  newsletterEmailConsent: unknown;
  programUpdatesConsent: unknown;
};

export type FinishNewsletterSignupInput = {
  sessionToken: unknown;
  phone: unknown;
  smsUpdatesConsent: unknown;
  pullToLaunch: unknown;
  learnMost: unknown;
  userAgent?: unknown;
};

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(160).optional().default(""),
);

const finishSchema = z.object({
  sessionToken: z.string().trim().min(1, "Your signup session is missing."),
  phone: optionalText,
  smsUpdatesConsent: z.boolean(),
  pullToLaunch: z
    .array(z.string())
    .max(NEWSLETTER_PULL_OPTIONS.length)
    .transform((values) => [...new Set(values)]),
  learnMost: z
    .array(z.string())
    .max(NEWSLETTER_LEARN_OPTIONS.length)
    .transform((values) => [...new Set(values)]),
  userAgent: z.string().max(500).nullable().optional(),
});

export async function startNewsletterSubscription(
  input: StartNewsletterSignupInput,
  deps: CreateQualificationIntakeDeps = {},
) {
  if (input.newsletterEmailConsent !== true) {
    throw new QualificationIntakeValidationError({
      [NEWSLETTER_QUESTION_IDS.emailConsent]: ["Consent is required."],
    });
  }

  const { newsletterEmailConsent, programUpdatesConsent, ...intake } = input;
  const result = await createQualificationIntakeSession(
    {
      ...intake,
      phone: "",
      qualificationFormId: NEWSLETTER_FORM_ID,
      completionRedirectPath: "/newsletter?subscribed=1",
      variantKey: "newsletter",
    },
    deps,
  );

  await saveQualificationAnswer(
    {
      sessionToken: result.sessionToken,
      questionId: NEWSLETTER_QUESTION_IDS.emailConsent,
      answerValue: newsletterEmailConsent,
    },
    deps,
  );
  await saveQualificationAnswer(
    {
      sessionToken: result.sessionToken,
      questionId: NEWSLETTER_QUESTION_IDS.programUpdatesConsent,
      answerValue: programUpdatesConsent === true,
    },
    deps,
  );
  await markNewsletterSubscription(
    {
      sessionToken: result.sessionToken,
      newsletterFormId: NEWSLETTER_FORM_ID,
      requiredConsentQuestionId: NEWSLETTER_QUESTION_IDS.emailConsent,
    },
    deps,
  );

  return {
    status: "started" as const,
    leadId: result.leadId,
    sessionToken: result.sessionToken,
  };
}

export async function finishNewsletterSubscription(
  input: FinishNewsletterSignupInput,
  deps: CreateQualificationIntakeDeps = {},
) {
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) {
    throw new QualificationSessionValidationError(
      parsed.error.flatten().fieldErrors,
    );
  }
  const values = parsed.data;
  const fieldErrors = newsletterFinishFieldErrors(values);
  if (Object.keys(fieldErrors).length) {
    throw new QualificationSessionValidationError(fieldErrors);
  }

  const session = await loadQualificationSessionForToken(
    { sessionToken: values.sessionToken },
    deps,
  );
  if (session.status !== "active" || session.formId !== NEWSLETTER_FORM_ID) {
    throw new QualificationSessionValidationError({
      session: [
        session.status === "completed"
          ? "This signup has already been completed."
          : "This signup session is no longer available.",
      ],
    });
  }

  const phone = values.phone ? normalizePhone(values.phone) : "";
  if (values.phone && !phone) {
    throw new QualificationSessionValidationError({
      phone: ["Enter a valid phone number with an area code."],
    });
  }
  if (phone) {
    await updateQualificationLeadPhone(
      { sessionToken: values.sessionToken, phone },
      deps,
    );
  }
  await saveQualificationAnswer(
    {
      sessionToken: values.sessionToken,
      questionId: NEWSLETTER_QUESTION_IDS.smsUpdatesConsent,
      answerValue: values.smsUpdatesConsent,
    },
    deps,
  );
  await saveQualificationAnswer(
    {
      sessionToken: values.sessionToken,
      questionId: NEWSLETTER_QUESTION_IDS.pullToLaunch,
      answerValue: values.pullToLaunch,
    },
    deps,
  );
  await saveQualificationAnswer(
    {
      sessionToken: values.sessionToken,
      questionId: NEWSLETTER_QUESTION_IDS.learnMost,
      answerValue: values.learnMost,
    },
    deps,
  );

  const completed = await completeNewsletterSignupSession(
    {
      sessionToken: values.sessionToken,
      newsletterFormId: NEWSLETTER_FORM_ID,
      requiredConsentQuestionId: NEWSLETTER_QUESTION_IDS.emailConsent,
      userAgent: values.userAgent,
    },
    deps,
  );
  return { status: "completed" as const, leadId: completed.leadSubmissionId };
}

function newsletterFinishFieldErrors(values: z.output<typeof finishSchema>) {
  const errors: Record<string, string[]> = {};
  if (values.smsUpdatesConsent && !values.phone) {
    errors.phone = ["Add a phone number to receive text updates."];
  }
  addUnknownOptions(
    errors,
    NEWSLETTER_QUESTION_IDS.pullToLaunch,
    values.pullToLaunch,
    NEWSLETTER_PULL_OPTIONS,
  );
  addUnknownOptions(
    errors,
    NEWSLETTER_QUESTION_IDS.learnMost,
    values.learnMost,
    NEWSLETTER_LEARN_OPTIONS,
  );
  return errors;
}

function addUnknownOptions(
  errors: Record<string, string[]>,
  field: string,
  values: string[],
  options: ReadonlyArray<{ value: string }>,
) {
  const allowed = new Set(options.map((option) => option.value));
  if (values.some((value) => !allowed.has(value))) {
    errors[field] = ["Choose one of the available options."];
  }
}
