/**
 * Field ids, labels, and option copy for the seeded "VP Lead Capture"
 * qualification form (form `a1b2c3d4-0000-4000-8000-000000000001`, see
 * supabase/migrations/20260814210000_vp_form_v3_operator_paths.sql and the
 * mirrored schema in src/lib/qualification/vp-seed-form.test.ts).
 *
 * This is the single source of truth for the inline /contact qualification
 * fields — copy here matches the seed verbatim. Do not invent new copy;
 * update the migration and this file together if the seeded form ever
 * changes.
 *
 * Form V2 (Kody, 2026-08-14): after the contact stage, a gate question asks
 * whether the visitor already operates vending machines. "Yes" routes to the
 * leaner Operator path (bottleneck + invest); "No" routes to the Standard
 * path (persona + confidence + timeline + invest). Each question is
 * presented one at a time with every answer visible.
 */

// The seeded "VP Lead Capture" qualification form. Passing it explicitly
// keeps callers independent of whichever form is the global default — the
// same id used by the /vp-quiz QA seam and page-builder resource pages.
export const VP_QUALIFICATION_FORM_ID = "a1b2c3d4-0000-4000-8000-000000000001";

export const VP_QUESTION_IDS = {
  consentUpdates: "consent_updates",
  consentContact: "consent_contact",
  operator: "operator",
  persona: "persona",
  confidence: "confidence",
  bottleneck: "bottleneck",
  timeline: "timeline",
  invest: "invest",
} as const;

export const VP_CONSENT_UPDATES_LABEL =
  "Email me the guide and vending resources.";

export const VP_CONSENT_CONTACT_LABEL =
  "I agree to receive calls and texts about my request. Msg rates may apply.";

export const VP_OPERATOR_LABEL = "Do you already operate vending machines?";

export const VP_PERSONA_LABEL =
  "Which of these sounds most like you right now?";

export const VP_CONFIDENCE_LABEL =
  "How confident are you in finding a location and picking a machine?";

export const VP_BOTTLENECK_LABEL =
  "What's holding your business back right now?";

export const VP_TIMELINE_LABEL =
  "When do you want your first machine earning income?";

export const VP_INVEST_LABEL = "How much capital are you ready to invest?";

// The Operator path words the same invest question around deploying capital
// into an existing route. Same stored question + option values — presentation
// copy only.
export const VP_INVEST_OPERATOR_LABEL =
  "How much capital are you ready to deploy?";

export type VpFieldOption = {
  readonly value: string;
  readonly label: string;
};

export const VP_OPERATOR_FIELD_OPTIONS: readonly VpFieldOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

// Persona replaces the old motivation + life-context questions. Option order
// is the doc's A–E; values are the lowercase persona keys (see
// derivePersonaKey in scoring.ts for the OPERATOR mapping).
export const VP_PERSONA_FIELD_OPTIONS: readonly VpFieldOption[] = [
  {
    value: "diversifier",
    label:
      "I'm not desperate. I want a real asset that beats real estate or the stock market",
  },
  { value: "escape", label: "I want to build something of my own" },
  {
    value: "triggered",
    label:
      "Something's changed in my life (or will be soon) and I'm ready to bet on myself",
  },
  { value: "family", label: "I want to build this with my spouse or kids" },
  { value: "unsure", label: "None of the above" },
];

export const VP_CONFIDENCE_FIELD_OPTIONS: readonly VpFieldOption[] = [
  {
    value: "very_confident",
    label: "Very confident in both — I just want expert feedback",
  },
  { value: "one_not_other", label: "Confident in one, not the other" },
  {
    value: "need_roadmap",
    label: "Not confident in either — I need a roadmap",
  },
  {
    value: "almost_bought",
    label: "Not confident — I almost bought a random machine online",
  },
];

export const VP_BOTTLENECK_FIELD_OPTIONS: readonly VpFieldOption[] = [
  { value: "locations", label: "Finding new profitable locations" },
  {
    value: "underperforming",
    label: "An underperforming machine or route",
  },
  { value: "financing", label: "Financing to add more machines" },
  { value: "other", label: "Something else" },
];

// Form V2 trims timeline to four rungs. The scoring engine still accepts the
// retired "next_30_days" value so completed sessions re-derive unchanged.
export const VP_TIMELINE_FIELD_OPTIONS: readonly VpFieldOption[] = [
  { value: "asap", label: "ASAP" },
  { value: "few_weeks", label: "Next few weeks" },
  { value: "1_3_months", label: "1–3 months" },
  { value: "unsure", label: "Not sure yet" },
];

// The dollar ladder, highest rung first, as Kody specified it. Only "no_cash"
// disqualifies (see scoring.ts).
export const VP_INVEST_FIELD_OPTIONS: readonly VpFieldOption[] = [
  { value: "15k_plus", label: "$15,000+" },
  { value: "10_15k", label: "$10,000 – $15,000" },
  { value: "5_10k", label: "$5,000 – $10,000" },
  { value: "3_5k", label: "$3,000 – $5,000" },
  { value: "1_3k", label: "$1,000 – $3,000" },
  { value: "no_cash", label: "None/Not ready to deploy capital yet" },
];

// Operator-path presentation of the same ladder: identical values, and the
// bottom rung reads "Not ready to deploy capital yet" per the Form V2 doc.
export const VP_INVEST_OPERATOR_FIELD_OPTIONS: readonly VpFieldOption[] =
  VP_INVEST_FIELD_OPTIONS.map((option) =>
    option.value === "no_cash"
      ? { value: "no_cash", label: "Not ready to deploy capital yet" }
      : option,
  );

const VP_STANDARD_ONLY_QUESTION_IDS: ReadonlySet<string> = new Set([
  VP_QUESTION_IDS.persona,
  VP_QUESTION_IDS.confidence,
  VP_QUESTION_IDS.timeline,
]);

/**
 * Applies the Form V2 branch rule to a question list: once the operator gate
 * is answered "yes" the Standard-path questions (persona/confidence/timeline)
 * drop out; "no" drops the Operator path's bottleneck; an unanswered gate
 * hides both branches until it is answered. Question lists without the gate
 * (older versions, non-VP forms) pass through untouched, so generic renderers
 * like the /qualify runtime can apply this unconditionally.
 */
export function filterVpOperatorPathQuestions<T extends { id: string }>(
  questions: readonly T[],
  answers: Record<string, unknown>,
): readonly T[] {
  const hasGate = questions.some(
    (question) => question.id === VP_QUESTION_IDS.operator,
  );
  if (!hasGate) return questions;
  const gate = answers[VP_QUESTION_IDS.operator];
  if (gate === "yes") {
    return questions.filter(
      (question) => !VP_STANDARD_ONLY_QUESTION_IDS.has(question.id),
    );
  }
  if (gate === "no") {
    return questions.filter(
      (question) => question.id !== VP_QUESTION_IDS.bottleneck,
    );
  }
  return questions.filter(
    (question) =>
      !VP_STANDARD_ONLY_QUESTION_IDS.has(question.id) &&
      question.id !== VP_QUESTION_IDS.bottleneck,
  );
}
