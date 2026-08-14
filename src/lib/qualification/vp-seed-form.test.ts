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
        {
          id: "next_30_days",
          label: "Next 30 days",
          value: "next_30_days",
        },
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
        { id: "15k_plus", label: "$15,000+", value: "15k_plus" },
        { id: "10_15k", label: "$10,000 - $15,000", value: "10_15k" },
        { id: "5_10k", label: "$5,000 - $10,000", value: "5_10k" },
        { id: "3_5k", label: "$3,000 - $5,000", value: "3_5k" },
        { id: "1_3k", label: "$1,000 - $3,000", value: "1_3k" },
        {
          id: "no_cash",
          label: "No available cash to invest",
          value: "no_cash",
        },
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

// Mirrors the Form V2 schema_snapshot embedded in
// supabase/migrations/20260814210000_vp_form_v3_operator_paths.sql (published
// version 3). Keep the two in sync — this test guarantees the seeded JSON is
// schema-valid and that copy matches src/lib/qualification/vp-fields.ts.
const VP_SEED_FORM_SCHEMA_V3 = {
  version: 1,
  questions: [
    VP_SEED_FORM_SCHEMA.questions[0],
    VP_SEED_FORM_SCHEMA.questions[1],
    {
      id: "operator",
      type: "single_choice",
      label: "Do you already operate vending machines?",
      required: false,
      normalizedRole: "operator_status",
      options: [
        { id: "yes", label: "Yes", value: "yes" },
        { id: "no", label: "No", value: "no" },
      ],
    },
    {
      id: "persona",
      type: "single_choice",
      label: "Which of these sounds most like you right now?",
      required: false,
      normalizedRole: "persona",
      options: [
        {
          id: "diversifier",
          label:
            "I'm not desperate. I want a real asset that beats real estate or the stock market",
          value: "diversifier",
        },
        {
          id: "escape",
          label: "I want to build something of my own",
          value: "escape",
        },
        {
          id: "triggered",
          label:
            "Something's changed in my life (or will be soon) and I'm ready to bet on myself",
          value: "triggered",
        },
        {
          id: "family",
          label: "I want to build this with my spouse or kids",
          value: "family",
        },
        { id: "unsure", label: "None of the above", value: "unsure" },
      ],
    },
    {
      id: "confidence",
      type: "single_choice",
      label:
        "How confident are you in finding a location and picking a machine?",
      required: false,
      normalizedRole: "confidence",
      options: [
        {
          id: "very_confident",
          label: "Very confident in both — I just want expert feedback",
          value: "very_confident",
        },
        {
          id: "one_not_other",
          label: "Confident in one, not the other",
          value: "one_not_other",
        },
        {
          id: "need_roadmap",
          label: "Not confident in either — I need a roadmap",
          value: "need_roadmap",
        },
        {
          id: "almost_bought",
          label: "Not confident — I almost bought a random machine online",
          value: "almost_bought",
        },
      ],
    },
    {
      id: "bottleneck",
      type: "single_choice",
      label: "What's holding your business back right now?",
      required: false,
      normalizedRole: "bottleneck",
      options: [
        {
          id: "locations",
          label: "Finding new profitable locations",
          value: "locations",
        },
        {
          id: "underperforming",
          label: "An underperforming machine or route",
          value: "underperforming",
        },
        {
          id: "financing",
          label: "Financing to add more machines",
          value: "financing",
        },
        { id: "other", label: "Something else", value: "other" },
      ],
    },
    {
      id: "timeline",
      type: "single_choice",
      label: "When do you want your first machine earning income?",
      required: false,
      normalizedRole: "timeline",
      options: [
        { id: "asap", label: "ASAP", value: "asap" },
        { id: "few_weeks", label: "Next few weeks", value: "few_weeks" },
        { id: "1_3_months", label: "1–3 months", value: "1_3_months" },
        { id: "unsure", label: "Not sure yet", value: "unsure" },
      ],
    },
    {
      id: "invest",
      type: "single_choice",
      label: "How much capital are you ready to invest?",
      required: true,
      normalizedRole: "available_capital",
      options: [
        { id: "15k_plus", label: "$15,000+", value: "15k_plus" },
        { id: "10_15k", label: "$10,000 – $15,000", value: "10_15k" },
        { id: "5_10k", label: "$5,000 – $10,000", value: "5_10k" },
        { id: "3_5k", label: "$3,000 – $5,000", value: "3_5k" },
        { id: "1_3k", label: "$1,000 – $3,000", value: "1_3k" },
        {
          id: "no_cash",
          label: "None/Not ready to deploy capital yet",
          value: "no_cash",
        },
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
      "next_30_days",
      "1_3_months",
      "unsure",
    ]);
  });

  it("carries the exact invest (Variant A) option values the scoring engine expects", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA);
    const invest = parsed.questions.find((q) => q.id === "invest");
    expect(invest?.options?.map((o) => o.value)).toEqual([
      "15k_plus",
      "10_15k",
      "5_10k",
      "3_5k",
      "1_3k",
      "no_cash",
    ]);
  });
});

describe("VP seed qualification form schema — version 3 (Form V2)", () => {
  it("parses without throwing and yields 8 questions", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA_V3);
    expect(parsed.questions).toHaveLength(8);
  });

  it("keeps only the consents and invest schema-required", () => {
    // Each path legitimately skips the other path's questions, so branch
    // questions must be optional at the schema level — path requiredness is
    // enforced in the inline service. Invest is answered on both paths.
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA_V3);
    const requiredIds = parsed.questions
      .filter((question) => question.required)
      .map((question) => question.id);
    expect(requiredIds).toEqual([
      "consent_updates",
      "consent_contact",
      "invest",
    ]);
  });

  it("carries the gate + branch question values the engine and service expect", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA_V3);
    const byId = new Map(parsed.questions.map((q) => [q.id, q]));
    expect(byId.get("operator")?.options?.map((o) => o.value)).toEqual([
      "yes",
      "no",
    ]);
    expect(byId.get("operator")?.normalizedRole).toBe("operator_status");
    expect(byId.get("persona")?.options?.map((o) => o.value)).toEqual([
      "diversifier",
      "escape",
      "triggered",
      "family",
      "unsure",
    ]);
    expect(byId.get("bottleneck")?.options?.map((o) => o.value)).toEqual([
      "locations",
      "underperforming",
      "financing",
      "other",
    ]);
    expect(byId.get("confidence")?.options?.map((o) => o.value)).toEqual([
      "very_confident",
      "one_not_other",
      "need_roadmap",
      "almost_bought",
    ]);
  });

  it("trims timeline to the four Form V2 rungs and keeps invest values intact", () => {
    const parsed = parseQualificationFormSchema(VP_SEED_FORM_SCHEMA_V3);
    const timeline = parsed.questions.find((q) => q.id === "timeline");
    expect(timeline?.options?.map((o) => o.value)).toEqual([
      "asap",
      "few_weeks",
      "1_3_months",
      "unsure",
    ]);
    const invest = parsed.questions.find((q) => q.id === "invest");
    expect(invest?.options?.map((o) => o.value)).toEqual([
      "15k_plus",
      "10_15k",
      "5_10k",
      "3_5k",
      "1_3k",
      "no_cash",
    ]);
  });
});
