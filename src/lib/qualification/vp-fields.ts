/**
 * Field ids, labels, and option copy for the seeded "VP Lead Capture"
 * qualification form (form `a1b2c3d4-0000-4000-8000-000000000001`, see
 * supabase/migrations/20260722120000_seed_vp_qualification_form.sql and the
 * mirrored schema in src/lib/qualification/vp-seed-form.test.ts).
 *
 * This is the single source of truth for the inline /contact qualification
 * fields (consent + timeline + invest) — copy here matches the seed
 * verbatim. Do not invent new copy; update the migration and this file
 * together if the seeded form ever changes.
 */

// The seeded "VP Lead Capture" qualification form. Passing it explicitly
// keeps callers independent of whichever form is the global default — the
// same id used by the /vp-quiz QA seam and page-builder resource pages.
export const VP_QUALIFICATION_FORM_ID = "a1b2c3d4-0000-4000-8000-000000000001";

export const VP_QUESTION_IDS = {
  consentUpdates: "consent_updates",
  consentContact: "consent_contact",
  timeline: "timeline",
  invest: "invest",
} as const;

export const VP_CONSENT_UPDATES_LABEL =
  "Email me the guide and vending resources.";

export const VP_CONSENT_CONTACT_LABEL =
  "I agree to receive calls and texts about my request. Msg rates may apply.";

export const VP_TIMELINE_LABEL =
  "When do you want your first machine placed and earning?";

export const VP_INVEST_LABEL = "How much are you ready to invest?";

export type VpFieldOption = {
  readonly value: string;
  readonly label: string;
};

export const VP_TIMELINE_FIELD_OPTIONS: readonly VpFieldOption[] = [
  { value: "asap", label: "As soon as possible" },
  { value: "few_weeks", label: "In the next few weeks" },
  { value: "1_3_months", label: "1-3 months out" },
  { value: "unsure", label: "Still figuring that out" },
];

// Variant A only — the dollar ladder. A/B is retired for the inline funnel.
export const VP_INVEST_FIELD_OPTIONS: readonly VpFieldOption[] = [
  { value: "lt_3k", label: "Less than $3,000" },
  { value: "3_5k", label: "$3,000 - $5,000" },
  { value: "5_10k", label: "$5,000 - $10,000" },
  { value: "10_15k", label: "$10,000 - $15,000" },
  { value: "15k_plus", label: "$15,000+" },
];
