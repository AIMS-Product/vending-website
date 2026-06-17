import { z } from "zod";

export const qualificationQuestionTypes = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "single_choice",
  "multiple_choice",
  "yes_no",
  "number",
  "currency",
  "budget_range",
  "state_region",
  "date",
  "timeframe",
  "consent",
] as const;

export const qualificationNormalizedRoles = [
  "budget",
  "timeline",
  "state_market",
  "business_stage",
  "goal",
  "available_capital",
  "location_status",
  "machine_goal",
  "consent",
  "contact_preference",
] as const;

export type QualificationQuestionType =
  (typeof qualificationQuestionTypes)[number];
export type QualificationNormalizedRole =
  (typeof qualificationNormalizedRoles)[number];

const questionIdSchema = z
  .string()
  .trim()
  .min(1, "Question id is required.")
  .max(80, "Question id is too long.")
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Use a stable question id.");

const optionIdSchema = z
  .string()
  .trim()
  .min(1, "Option id is required.")
  .max(80, "Option id is too long.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use a stable option id.");

const trimmedText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max);

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value ?? "");

const optionSchema = z
  .object({
    id: optionIdSchema,
    label: trimmedText("Option label", 140),
    value: z.string().trim().max(180).optional(),
  })
  .strict();

const questionSchema = z
  .object({
    id: questionIdSchema,
    type: z.enum(qualificationQuestionTypes),
    label: trimmedText("Question label", 220),
    helpText: optionalTrimmedText(600),
    placeholder: optionalTrimmedText(180),
    required: z.boolean().default(true),
    normalizedRole: z.enum(qualificationNormalizedRoles).optional(),
    options: z.array(optionSchema).max(30).optional(),
  })
  .strict()
  .superRefine((question, ctx) => {
    if (
      optionQuestionTypes.has(question.type) &&
      (!question.options || question.options.length < 1)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `${question.type} questions need at least one option.`,
      });
    }

    if (!question.options) return;
    const optionIds = new Set<string>();
    for (const [index, option] of question.options.entries()) {
      if (optionIds.has(option.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "id"],
          message: "Option ids must be unique within a question.",
        });
      }
      optionIds.add(option.id);
    }
  });

const optionQuestionTypes = new Set<QualificationQuestionType>([
  "single_choice",
  "multiple_choice",
  "budget_range",
  "state_region",
  "timeframe",
]);

export const qualificationFormSchema = z
  .object({
    version: z.literal(1),
    questions: z.array(questionSchema).min(1).max(30),
  })
  .strict()
  .superRefine((form, ctx) => {
    const questionIds = new Set<string>();
    for (const [index, question] of form.questions.entries()) {
      if (questionIds.has(question.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "id"],
          message: "Question ids must be unique within a form.",
        });
      }
      questionIds.add(question.id);
    }
  });

export type QualificationQuestion = z.infer<typeof questionSchema>;
export type QualificationFormDefinition = z.infer<
  typeof qualificationFormSchema
>;

export type QualificationQuestionSnapshot = {
  id: string;
  type: QualificationQuestionType;
  label: string;
  helpText?: string;
  placeholder?: string;
  required: boolean;
  normalizedRole?: QualificationNormalizedRole;
  options?: Array<{
    id: string;
    label: string;
    value?: string;
  }>;
};

export function parseQualificationFormSchema(
  input: unknown,
): QualificationFormDefinition {
  return qualificationFormSchema.parse(input);
}

export function buildQuestionSnapshots(
  form: QualificationFormDefinition,
): QualificationQuestionSnapshot[] {
  return form.questions.map((question) => {
    const snapshot: QualificationQuestionSnapshot = {
      id: question.id,
      type: question.type,
      label: question.label,
      required: question.required,
    };

    if (question.helpText) snapshot.helpText = question.helpText;
    if (question.placeholder) snapshot.placeholder = question.placeholder;
    if (question.normalizedRole) {
      snapshot.normalizedRole = question.normalizedRole;
    }
    if (question.options?.length) {
      snapshot.options = question.options.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.value ? { value: option.value } : {}),
      }));
    }

    return snapshot;
  });
}

export function normalizedRolesForForm(
  form: QualificationFormDefinition,
): QualificationNormalizedRole[] {
  return Array.from(
    new Set(
      form.questions.flatMap((question) =>
        question.normalizedRole ? [question.normalizedRole] : [],
      ),
    ),
  );
}
