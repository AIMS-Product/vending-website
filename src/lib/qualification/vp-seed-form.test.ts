import { describe, expect, it } from "vitest";
import { parseQualificationFormSchema } from "./forms";

// Mirrors the schema_snapshot embedded in
// supabase/migrations/20260722120000_seed_vp_qualification_form.sql. Keep the
// two in sync — this test guarantees the seeded JSON is schema-valid.
const VP_SEED_FORM_SCHEMA = {
  version: 1,
  questions: [
    {
      id: "consent_updates",
      type: "consent",
      label: "Email me the guide and vending resources.",
      required: true,
      normalizedRole: "consent",
    },
    {
      id: "consent_contact",
      type: "consent",
      label:
        "I agree to receive calls and texts about my request. Msg rates may apply.",
      required: true,
      normalizedRole: "contact_preference",
    },
    {
      id: "timeline",
      type: "single_choice",
      label: "When do you want your first machine placed and earning?",
      required: true,
      normalizedRole: "timeline",
      options: [
        { id: "asap", label: "As soon as possible", value: "asap" },
        { id: "few_weeks", label: "In the next few weeks", value: "few_weeks" },
        { id: "1_3_months", label: "1-3 months out", value: "1_3_months" },
        { id: "unsure", label: "Still figuring that out", value: "unsure" },
      ],
    },
    {
      id: "invest",
      type: "single_choice",
      label: "How much are you ready to invest?",
      required: true,
      normalizedRole: "available_capital",
      options: [
        { id: "lt_3k", label: "Less than $3,000", value: "lt_3k" },
        { id: "3_5k", label: "$3,000 - $5,000", value: "3_5k" },
        { id: "5_10k", label: "$5,000 - $10,000", value: "5_10k" },
        { id: "10_15k", label: "$10,000 - $15,000", value: "10_15k" },
        { id: "15k_plus", label: "$15,000+", value: "15k_plus" },
      ],
    },
    {
      id: "pull_to_launch",
      type: "multiple_choice",
      label: "What's pulling you to launch your own business?",
      required: false,
      normalizedRole: "goal",
      options: [
        {
          id: "replace_job",
          label: "Replace my full-time job",
          value: "replace_job",
        },
        {
          id: "generational_wealth",
          label: "Build generational wealth for my family",
          value: "generational_wealth",
        },
        {
          id: "diversify_income",
          label: "Diversify my income streams",
          value: "diversify_income",
        },
        {
          id: "life_event",
          label: "A life event is making me reconsider",
          value: "life_event",
        },
        { id: "other", label: "Other", value: "other" },
      ],
    },
    {
      id: "learn_most",
      type: "multiple_choice",
      label: "What do you want to learn most?",
      required: false,
      options: [
        {
          id: "getting_started",
          label: "Getting started the right way",
          value: "getting_started",
        },
        {
          id: "machines_products",
          label: "Machines & products (the vending basics)",
          value: "machines_products",
        },
        {
          id: "locations",
          label: "Finding & securing locations",
          value: "locations",
        },
        {
          id: "financing",
          label: "Financing & funding ($0-down, ROI)",
          value: "financing",
        },
        { id: "legal", label: "Permits, legal & state rules", value: "legal" },
      ],
    },
  ],
};

describe("VP seed qualification form schema", () => {
  it("parses without throwing and yields 6 questions", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA);
    expect(parsed.questions).toHaveLength(6);
  });

  it("carries the exact timeline option values the scoring engine expects", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA);
    const timeline = parsed.questions.find((q) => q.id === "timeline");
    expect(timeline?.options?.map((o) => o.value)).toEqual([
      "asap",
      "few_weeks",
      "1_3_months",
      "unsure",
    ]);
  });

  it("carries the exact invest (Variant A) option values the scoring engine expects", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA);
    const invest = parsed.questions.find((q) => q.id === "invest");
    expect(invest?.options?.map((o) => o.value)).toEqual([
      "lt_3k",
      "3_5k",
      "5_10k",
      "10_15k",
      "15k_plus",
    ]);
  });
});
