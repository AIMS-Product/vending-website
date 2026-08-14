import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VP_QUESTION_IDS } from "@/lib/qualification/vp-fields";
import { QualificationIntakeValidationError } from "./qualification-intake";
import { QualificationSessionValidationError } from "./qualification-sessions";
import {
  finishInlineQualification,
  startInlineQualification,
  submitInlineQualification,
} from "./qualification-inline";
import type { Database, Json, Tables } from "@/types/database";

type LeadRow = Tables<"lead_submissions">;
type QualificationFormRow = Tables<"qualification_forms">;
type QualificationFormVersionRow = Tables<"qualification_form_versions">;
type QualificationSessionRow = Tables<"qualification_sessions">;
type QualificationAnswerRow = Tables<"qualification_answers">;
type CloseSyncEventRow = Tables<"close_sync_events">;
type InlineQualificationClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  leads: LeadRow[];
  forms: QualificationFormRow[];
  versions: QualificationFormVersionRow[];
  sessions: QualificationSessionRow[];
  answers: QualificationAnswerRow[];
  events: CloseSyncEventRow[];
};

const VP_FORM_ID = "form_vp";
const VP_VERSION_ID = "version_vp_1";

// Mirrors the four required questions on the seeded VP Lead Capture form
// (src/lib/qualification/vp-seed-form.test.ts) — consent x2 + timeline +
// invest (Variant A dollar ladder).
const vpSchema = {
  version: 1,
  questions: [
    {
      id: VP_QUESTION_IDS.consentUpdates,
      type: "consent",
      label: "Email me the guide and vending resources.",
      required: true,
      normalizedRole: "consent",
    },
    {
      id: VP_QUESTION_IDS.consentContact,
      type: "consent",
      label:
        "I agree to receive calls and texts about my request. Msg rates may apply.",
      required: true,
      normalizedRole: "contact_preference",
    },
    {
      id: VP_QUESTION_IDS.timeline,
      type: "single_choice",
      label: "When do you want your first machine placed and earning?",
      required: true,
      normalizedRole: "timeline",
      options: [
        { id: "asap", label: "As soon as possible", value: "asap" },
        { id: "few_weeks", label: "In the next few weeks", value: "few_weeks" },
        { id: "1_3_months", label: "1-3 months out", value: "1_3_months" },
        {
          id: "next_30_days",
          label: "Next 30 days",
          value: "next_30_days",
        },
        { id: "unsure", label: "Still figuring that out", value: "unsure" },
      ],
    },
    {
      id: VP_QUESTION_IDS.invest,
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
  ],
};

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_1",
    idempotency_key: "intake_1",
    form_type: "contact",
    status: "received",
    full_name: "Jane Buyer",
    email: "buyer@example.com",
    phone: "555-0101",
    city: null,
    state_region: null,
    business_stage: null,
    budget: null,
    timeline: null,
    message: null,
    source_path: "/contact",
    landing_path: "/contact",
    referrer: null,
    user_agent: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    source_page_id: null,
    source_page_slug: null,
    target_keyword: null,
    source_block_id: null,
    source_cta_tracking_name: null,
    metadata: {},
    notification_attempted_at: null,
    notification_sent_at: null,
    notification_error: null,
    lifecycle_status: "contact_captured",
    qualification_summary: {},
    latest_qualification_form_id: null,
    latest_qualification_form_version_id: null,
    latest_qualification_session_id: null,
    latest_qualification_started_at: null,
    latest_qualification_completed_at: null,
    close_lead_id: null,
    close_contact_id: null,
    close_sync_status: "pending",
    close_sync_attempt_count: 0,
    close_sync_next_retry_at: null,
    close_sync_last_attempted_at: null,
    close_sync_synced_at: null,
    close_sync_last_error: null,
    created_at: "2026-07-22T09:00:00.000Z",
    updated_at: "2026-07-22T09:00:00.000Z",
    ...overrides,
  };
}

// Mirrors the Form V2 published schema (version 3, see the
// 20260814210000_vp_form_v3_operator_paths.sql migration): the operator gate
// plus its branch questions, all schema-optional except invest — path
// requiredness lives in the inline service under test here.
const vpSchemaV3 = {
  version: 1,
  questions: [
    ...vpSchema.questions.filter(
      (question) =>
        question.id !== VP_QUESTION_IDS.timeline &&
        question.id !== VP_QUESTION_IDS.invest,
    ),
    {
      id: VP_QUESTION_IDS.operator,
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
      id: VP_QUESTION_IDS.persona,
      type: "single_choice",
      label: "Which of these sounds most like you right now?",
      required: false,
      normalizedRole: "persona",
      options: [
        { id: "diversifier", label: "Diversifier", value: "diversifier" },
        { id: "escape", label: "Escape", value: "escape" },
        { id: "triggered", label: "Triggered", value: "triggered" },
        { id: "family", label: "Family", value: "family" },
        { id: "unsure", label: "None of the above", value: "unsure" },
      ],
    },
    {
      id: VP_QUESTION_IDS.confidence,
      type: "single_choice",
      label:
        "How confident are you in finding a location and picking a machine?",
      required: false,
      normalizedRole: "confidence",
      options: [
        {
          id: "very_confident",
          label: "Very confident",
          value: "very_confident",
        },
        {
          id: "one_not_other",
          label: "One, not the other",
          value: "one_not_other",
        },
        { id: "need_roadmap", label: "Need a roadmap", value: "need_roadmap" },
        { id: "almost_bought", label: "Almost bought", value: "almost_bought" },
      ],
    },
    {
      id: VP_QUESTION_IDS.bottleneck,
      type: "single_choice",
      label: "What's holding your business back right now?",
      required: false,
      normalizedRole: "bottleneck",
      options: [
        { id: "locations", label: "Locations", value: "locations" },
        {
          id: "underperforming",
          label: "Underperforming",
          value: "underperforming",
        },
        { id: "financing", label: "Financing", value: "financing" },
        { id: "other", label: "Something else", value: "other" },
      ],
    },
    {
      ...vpSchema.questions.find(
        (question) => question.id === VP_QUESTION_IDS.timeline,
      )!,
      required: false,
    },
    vpSchema.questions.find(
      (question) => question.id === VP_QUESTION_IDS.invest,
    )!,
  ],
};

type VpSchema = typeof vpSchema | typeof vpSchemaV3;

function makeForm(schema: VpSchema = vpSchema): QualificationFormRow {
  return {
    id: VP_FORM_ID,
    name: "VP Lead Capture",
    slug: "vp-lead-capture",
    status: "published",
    is_default: false,
    draft_schema: schema as unknown as Json,
    current_published_version_id: VP_VERSION_ID,
    created_by: null,
    updated_by: null,
    created_at: "2026-07-22T00:00:00.000Z",
    updated_at: "2026-07-22T00:00:00.000Z",
  };
}

function makeVersion(schema: VpSchema = vpSchema): QualificationFormVersionRow {
  return {
    id: VP_VERSION_ID,
    form_id: VP_FORM_ID,
    version_number: schema === vpSchema ? 2 : 3,
    schema_snapshot: schema as unknown as Json,
    question_count: schema.questions.length,
    normalized_roles: schema.questions
      .map((question) => question.normalizedRole)
      .filter((role): role is string => Boolean(role)),
    published_by: null,
    published_at: "2026-07-22T00:00:00.000Z",
    created_at: "2026-07-22T00:00:00.000Z",
  };
}

function buildClient(initial: Partial<FakeState> = {}, schema?: VpSchema) {
  const state: FakeState = {
    leads: [],
    forms: [makeForm(schema)],
    versions: [makeVersion(schema)],
    sessions: [],
    answers: [],
    events: [],
    ...initial,
  };

  return {
    state,
    client: {
      from(table: string) {
        return new FakeQuery(table, state);
      },
    } as unknown as InlineQualificationClient,
  };
}

class FakeQuery {
  private filters: Array<{ key: string; value: unknown }> = [];
  private orderKey: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;

  constructor(
    private table: string,
    private state: FakeState,
  ) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value });
    return this;
  }

  order(key: string, opts: { ascending?: boolean } = {}) {
    this.orderKey = key;
    this.orderAscending = opts.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async maybeSingle() {
    return { data: this.rows()[0] ?? null, error: null };
  }

  async single() {
    const row = this.rows()[0] ?? null;
    return { data: row, error: row ? null : { message: "Not found" } };
  }

  // Some callers (listAnswers) await the builder directly without a
  // terminal .single()/.maybeSingle(); mirrors the existing qualification
  // service test fakes.
  then(resolve: (value: { data: unknown[]; error: null }) => void) {
    resolve({ data: this.rows(), error: null });
  }

  insert(value: Record<string, unknown>) {
    if (this.table === "lead_submissions") {
      const row = makeLead({
        id: `lead_${this.state.leads.length + 1}`,
        ...(value as Partial<LeadRow>),
      });
      this.state.leads.push(row);
      return {
        select: () => ({ single: async () => ({ data: row, error: null }) }),
      };
    }

    if (this.table === "qualification_sessions") {
      const defaults: Partial<QualificationSessionRow> = {
        id: `session_${this.state.sessions.length + 1}`,
        answer_count: 0,
        completed_at: null,
        consent_accepted_at: null,
        consent_question_snapshot: null,
        consent_user_agent: null,
        created_at: "2026-07-22T09:00:00.000Z",
        normalized_summary: {},
        status: "pending",
        updated_at: "2026-07-22T09:00:00.000Z",
      };
      const row = {
        ...defaults,
        ...(value as Partial<QualificationSessionRow>),
      } as QualificationSessionRow;
      this.state.sessions.push(row);
      return {
        select: () => ({ single: async () => ({ data: row, error: null }) }),
      };
    }

    if (this.table === "qualification_answers") {
      const defaults: Partial<QualificationAnswerRow> = {
        id: `answer_${this.state.answers.length + 1}`,
        created_at: "2026-07-22T09:00:00.000Z",
        updated_at: "2026-07-22T09:00:00.000Z",
        answered_at: "2026-07-22T09:00:00.000Z",
        option_snapshots: [],
        normalized_value: {},
      };
      const row = {
        ...defaults,
        ...(value as Partial<QualificationAnswerRow>),
      } as QualificationAnswerRow;
      this.state.answers.push(row);
      return {
        select: () => ({ single: async () => ({ data: row, error: null }) }),
      };
    }

    if (this.table === "close_sync_events") {
      const defaults: Partial<CloseSyncEventRow> = {
        id: `event_${this.state.events.length + 1}`,
        attempt_count: 0,
        close_contact_id: null,
        close_lead_id: null,
        created_at: "2026-07-22T09:00:00.000Z",
        dedupe_key: null,
        last_attempted_at: null,
        last_error: null,
        max_attempts: 8,
        next_retry_at: "2026-07-22T09:00:00.000Z",
        synced_at: null,
        updated_at: "2026-07-22T09:00:00.000Z",
      };
      const row = {
        ...defaults,
        ...(value as Partial<CloseSyncEventRow>),
      } as CloseSyncEventRow;
      this.state.events.push(row);
      return {
        select: () => ({ single: async () => ({ data: row, error: null }) }),
      };
    }

    throw new Error(`Unexpected insert into ${this.table}`);
  }

  update(patch: Record<string, unknown>) {
    const apply = async () => {
      if (this.table === "lead_submissions") {
        this.state.leads = this.state.leads.map((row) =>
          this.matches(row) ? ({ ...row, ...patch } as LeadRow) : row,
        );
      } else if (this.table === "qualification_sessions") {
        this.state.sessions = this.state.sessions.map((row) =>
          this.matches(row)
            ? ({ ...row, ...patch } as QualificationSessionRow)
            : row,
        );
      } else if (this.table === "qualification_answers") {
        this.state.answers = this.state.answers.map((row) =>
          this.matches(row)
            ? ({ ...row, ...patch } as QualificationAnswerRow)
            : row,
        );
      } else {
        throw new Error(`Unexpected update to ${this.table}`);
      }
      return { data: null, error: null };
    };
    return {
      eq: (key: string, value: unknown) => {
        this.eq(key, value);
        return apply();
      },
    };
  }

  private rows() {
    let rows: Array<
      | LeadRow
      | QualificationFormRow
      | QualificationFormVersionRow
      | QualificationSessionRow
      | QualificationAnswerRow
      | CloseSyncEventRow
    >;

    if (this.table === "lead_submissions") rows = [...this.state.leads];
    else if (this.table === "qualification_forms") rows = [...this.state.forms];
    else if (this.table === "qualification_form_versions") {
      rows = [...this.state.versions];
    } else if (this.table === "qualification_sessions") {
      rows = [...this.state.sessions];
    } else if (this.table === "qualification_answers") {
      rows = [...this.state.answers];
    } else if (this.table === "close_sync_events") {
      rows = [...this.state.events];
    } else {
      rows = [];
    }

    rows = rows.filter((row) => this.matches(row));
    if (this.orderKey) {
      const orderKey = this.orderKey;
      rows.sort((a, b) => {
        const av = (a as Record<string, unknown>)[orderKey];
        const bv = (b as Record<string, unknown>)[orderKey];
        const compared = String(av ?? "").localeCompare(String(bv ?? ""));
        return this.orderAscending ? compared : -compared;
      });
    }
    if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
    return rows;
  }

  private matches(row: object) {
    return this.filters.every(
      ({ key, value }) => (row as Record<string, unknown>)[key] === value,
    );
  }
}

// Stage 1 collects the contact details and both consents; the one-shot path
// posts the same fields plus the two answers.
function startInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: undefined,
    fullName: "Jane Buyer",
    email: "buyer@example.com",
    phone: "555-0101",
    qualificationFormId: VP_FORM_ID,
    sourcePath: "/contact",
    landingPath: "/contact",
    consentUpdates: true,
    consentContact: true,
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    ...startInput(),
    timeline: "asap",
    invest: "15k_plus",
    ...overrides,
  };
}

describe("submitInlineQualification", () => {
  it("scores a perfect-fit submission end to end (asap + $15k+)", async () => {
    const fake = buildClient();

    const result = await submitInlineQualification(
      baseInput({ idempotencyKey: "inline-1" }),
      { client: fake.client, tokenFactory: () => "raw_inline_token_1" },
    );

    expect(result).toEqual({
      status: "completed",
      leadId: fake.state.leads[0]?.id,
      thankYouState: "perfect_fit",
      score: 100,
    });
    expect(fake.state.sessions[0]?.status).toBe("completed");
    expect(fake.state.leads[0]?.lifecycle_status).toBe("qualified");
    expect(fake.state.sessions[0]?.consent_accepted_at).toBeTruthy();
    expect(
      fake.state.events.some(
        (e) => e.event_type === "qualification_enrichment",
      ),
    ).toBe(true);
  });

  it("scores a strong-fit submission (few weeks + $5k-$10k)", async () => {
    const fake = buildClient();

    const result = await submitInlineQualification(
      baseInput({
        idempotencyKey: "inline-2",
        timeline: "few_weeks",
        invest: "5_10k",
      }),
      { client: fake.client, tokenFactory: () => "raw_inline_token_2" },
    );

    expect(result).toEqual({
      status: "completed",
      leadId: fake.state.leads[0]?.id,
      thankYouState: "strong_fit",
      score: 70,
    });
  });

  it("scores a good-potential submission (1-3 months + $3k-$5k)", async () => {
    const fake = buildClient();

    const result = await submitInlineQualification(
      baseInput({
        idempotencyKey: "inline-3",
        timeline: "1_3_months",
        invest: "3_5k",
      }),
      { client: fake.client, tokenFactory: () => "raw_inline_token_3" },
    );

    expect(result).toEqual({
      status: "completed",
      leadId: fake.state.leads[0]?.id,
      thankYouState: "good_potential",
      score: 35,
    });
  });

  it("scores a not-right-time submission on a low but non-disqualifying total", async () => {
    const fake = buildClient();

    const result = await submitInlineQualification(
      baseInput({
        idempotencyKey: "inline-4",
        timeline: "unsure",
        invest: "3_5k",
      }),
      { client: fake.client, tokenFactory: () => "raw_inline_token_4" },
    );

    expect(result).toEqual({
      status: "completed",
      leadId: fake.state.leads[0]?.id,
      thankYouState: "not_right_time",
      score: 25,
    });
  });

  it("disqualifies (no available cash) regardless of timeline", async () => {
    const fake = buildClient();

    const result = await submitInlineQualification(
      baseInput({
        idempotencyKey: "inline-5",
        timeline: "asap",
        invest: "no_cash",
      }),
      { client: fake.client, tokenFactory: () => "raw_inline_token_5" },
    );

    expect(result).toEqual({
      status: "completed",
      leadId: fake.state.leads[0]?.id,
      thankYouState: "not_right_time",
      score: 40,
    });
    expect(fake.state.leads[0]?.qualification_summary).toMatchObject({
      qualification_band: "disqualify",
    });
  });

  it("rejects a submission missing the updates consent, without completing or scoring", async () => {
    const fake = buildClient();

    await expect(
      submitInlineQualification(
        baseInput({
          idempotencyKey: "inline-missing-consent-updates",
          consentUpdates: false,
        }),
        { client: fake.client, tokenFactory: () => "raw_inline_token_6" },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { consent_updates: ["Consent is required."] },
    });

    expect(fake.state.sessions[0]?.status).not.toBe("completed");
    expect(fake.state.leads[0]?.lifecycle_status).not.toBe("qualified");
    expect(
      fake.state.events.some(
        (e) => e.event_type === "qualification_enrichment",
      ),
    ).toBe(false);
  });

  it("rejects a submission missing the contact-preference consent", async () => {
    const fake = buildClient();

    await expect(
      submitInlineQualification(
        baseInput({
          idempotencyKey: "inline-missing-consent-contact",
          consentContact: false,
        }),
        { client: fake.client, tokenFactory: () => "raw_inline_token_7" },
      ),
    ).rejects.toBeInstanceOf(QualificationSessionValidationError);

    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });

  it("rejects a submission missing timeline", async () => {
    const fake = buildClient();

    await expect(
      submitInlineQualification(
        baseInput({ idempotencyKey: "inline-missing-timeline", timeline: "" }),
        { client: fake.client, tokenFactory: () => "raw_inline_token_8" },
      ),
    ).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ timeline: expect.any(Array) }),
    });
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });

  it("rejects a submission missing invest", async () => {
    const fake = buildClient();

    await expect(
      submitInlineQualification(
        baseInput({ idempotencyKey: "inline-missing-invest", invest: "" }),
        { client: fake.client, tokenFactory: () => "raw_inline_token_9" },
      ),
    ).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ invest: expect.any(Array) }),
    });
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });

  it("rejects invalid contact fields via the intake validation (reused, not rewritten)", async () => {
    const fake = buildClient();

    await expect(
      submitInlineQualification(
        baseInput({
          idempotencyKey: "inline-bad-email",
          email: "not-an-email",
        }),
        { client: fake.client, tokenFactory: () => "raw_inline_token_10" },
      ),
    ).rejects.toBeInstanceOf(QualificationIntakeValidationError);
  });

  it("reuses the same lead on a duplicate idempotency key (no duplicate leads)", async () => {
    const fake = buildClient();
    let tokenCount = 0;

    const deps = {
      client: fake.client,
      tokenFactory: () => `raw_inline_token_dup_${(tokenCount += 1)}`,
    };

    const first = await submitInlineQualification(
      baseInput({ idempotencyKey: "inline-dup" }),
      deps,
    );
    const second = await submitInlineQualification(
      baseInput({ idempotencyKey: "inline-dup" }),
      deps,
    );

    expect(fake.state.leads).toHaveLength(1);
    expect(first.leadId).toBe(second.leadId);
  });

  it("never leaks the raw session token into the returned result", async () => {
    const fake = buildClient();
    const rawToken = "raw_inline_token_secret_value";

    const result = await submitInlineQualification(
      baseInput({ idempotencyKey: "inline-no-leak" }),
      { client: fake.client, tokenFactory: () => rawToken },
    );

    expect(Object.keys(result).sort()).toEqual([
      "leadId",
      "score",
      "status",
      "thankYouState",
    ]);
    expect(JSON.stringify(result)).not.toContain(rawToken);
  });
});

// The two-stage /contact form: stage 1 captures the contact + both consents
// (the lead is persisted and contactable from here on), stage 2 posts the
// session token back with the timeline/invest answers and scores.
// See .claude/specs/2026-07-28-two-stage-inline-contact-form.md.
describe("startInlineQualification", () => {
  it("persists the lead, saves both consents, and returns the session token", async () => {
    const fake = buildClient();

    const result = await startInlineQualification(
      startInput({ idempotencyKey: "stage-one-1" }),
      { client: fake.client, tokenFactory: () => "raw_stage_token_1" },
    );

    expect(result).toEqual({
      status: "started",
      leadId: fake.state.leads[0]?.id,
      sessionToken: "raw_stage_token_1",
    });
    expect(fake.state.leads).toHaveLength(1);
    expect(fake.state.leads[0]?.email).toBe("buyer@example.com");

    const consents = fake.state.answers.filter(
      (answer) =>
        answer.question_id === VP_QUESTION_IDS.consentUpdates ||
        answer.question_id === VP_QUESTION_IDS.consentContact,
    );
    expect(consents).toHaveLength(2);
    expect(consents.every((answer) => answer.answer_value === true)).toBe(true);

    // Stage 1 does not answer, score, or complete anything.
    expect(fake.state.answers).toHaveLength(2);
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
    expect(
      fake.state.events.some(
        (e) => e.event_type === "qualification_enrichment",
      ),
    ).toBe(false);
  });

  it("queues the Close lead push so a stage-1 lead is contactable before stage 2", async () => {
    const fake = buildClient();

    await startInlineQualification(
      startInput({ idempotencyKey: "stage-one-2" }),
      {
        client: fake.client,
        tokenFactory: () => "raw_stage_token_2",
      },
    );

    expect(
      fake.state.events.some((e) => e.event_type === "lead_create_or_update"),
    ).toBe(true);
  });

  it("rejects a missing consent before any lead is captured", async () => {
    const fake = buildClient();

    await expect(
      startInlineQualification(
        startInput({
          idempotencyKey: "stage-one-no-consent",
          consentUpdates: false,
        }),
        { client: fake.client, tokenFactory: () => "raw_stage_token_3" },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { consent_updates: ["Consent is required."] },
    });

    // Consent is what makes the person contactable — no consent, no record.
    expect(fake.state.leads).toHaveLength(0);
    expect(fake.state.sessions).toHaveLength(0);
    expect(fake.state.events).toHaveLength(0);
  });

  it("rejects invalid contact fields via the intake validation", async () => {
    const fake = buildClient();

    await expect(
      startInlineQualification(
        startInput({ idempotencyKey: "stage-one-bad-email", email: "nope" }),
        { client: fake.client, tokenFactory: () => "raw_stage_token_4" },
      ),
    ).rejects.toBeInstanceOf(QualificationIntakeValidationError);
  });
});

describe("finishInlineQualification", () => {
  async function startedSession(token: string, idempotencyKey: string) {
    const fake = buildClient();
    const started = await startInlineQualification(
      startInput({ idempotencyKey }),
      { client: fake.client, tokenFactory: () => token },
    );
    return { fake, started };
  }

  it("scores and completes the session the token points at", async () => {
    const { fake, started } = await startedSession(
      "raw_finish_token_1",
      "stage-two-1",
    );

    const result = await finishInlineQualification(
      {
        sessionToken: started.sessionToken,
        timeline: "asap",
        invest: "15k_plus",
      },
      { client: fake.client },
    );

    expect(result).toEqual({
      status: "completed",
      leadId: started.leadId,
      thankYouState: "perfect_fit",
      score: 100,
    });
    expect(fake.state.sessions[0]?.status).toBe("completed");
    expect(fake.state.leads[0]?.lifecycle_status).toBe("qualified");
    expect(
      fake.state.events.some(
        (e) => e.event_type === "qualification_enrichment",
      ),
    ).toBe(true);
  });

  it("rejects a second finish on an already-completed session without re-scoring", async () => {
    const { fake, started } = await startedSession(
      "raw_finish_token_2",
      "stage-two-2",
    );

    await finishInlineQualification(
      {
        sessionToken: started.sessionToken,
        timeline: "asap",
        invest: "15k_plus",
      },
      { client: fake.client },
    );

    await expect(
      finishInlineQualification(
        {
          sessionToken: started.sessionToken,
          timeline: "unsure",
          invest: "no_cash",
        },
        { client: fake.client },
      ),
    ).rejects.toBeInstanceOf(QualificationSessionValidationError);

    // The first result stands: no re-scoring, no second enrichment event.
    expect(fake.state.leads[0]?.qualification_summary).toMatchObject({
      qualification_score: 100,
    });
    expect(
      fake.state.events.filter(
        (e) => e.event_type === "qualification_enrichment",
      ),
    ).toHaveLength(1);
  });

  it("rejects an unknown session token", async () => {
    const fake = buildClient();

    await expect(
      finishInlineQualification(
        { sessionToken: "not_a_real_token", timeline: "asap", invest: "1_3k" },
        { client: fake.client },
      ),
    ).rejects.toBeInstanceOf(QualificationSessionValidationError);
  });

  it("rejects a blank session token without touching the database", async () => {
    const fake = buildClient();

    await expect(
      finishInlineQualification(
        { sessionToken: "", timeline: "asap", invest: "1_3k" },
        { client: fake.client },
      ),
    ).rejects.toBeInstanceOf(QualificationSessionValidationError);
  });

  it("rejects a missing timeline without completing the session", async () => {
    const { fake, started } = await startedSession(
      "raw_finish_token_3",
      "stage-two-3",
    );

    await expect(
      finishInlineQualification(
        {
          sessionToken: started.sessionToken,
          timeline: "",
          invest: "15k_plus",
        },
        { client: fake.client },
      ),
    ).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ timeline: expect.any(Array) }),
    });
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });

  it("leaves an abandoned stage 2 as a started-but-unfinished lead", async () => {
    const { fake } = await startedSession("raw_abandon_token", "stage-two-4");

    // The visitor never posts stage 2. This is the case /admin/analytics
    // measures as "offered the questions but never finished".
    const lead = fake.state.leads[0];
    expect(lead?.latest_qualification_started_at).toBeTruthy();
    expect(lead?.latest_qualification_completed_at).toBeNull();
    expect(lead?.lifecycle_status).toBe("qualification_pending");
    expect(lead?.email).toBe("buyer@example.com");
  });
});

// Form V2 (Kody, 2026-08-14): the operator gate routes "yes" to the leaner
// Operator path and "no" to the Standard path. Sessions here run against the
// version-3 schema the migration publishes.
describe("finishInlineQualification (Form V2 paths)", () => {
  async function startedV3Session(token: string, idempotencyKey: string) {
    const fake = buildClient({}, vpSchemaV3);
    const started = await startInlineQualification(
      startInput({ idempotencyKey }),
      { client: fake.client, tokenFactory: () => token },
    );
    return { fake, started };
  }

  it("scores an operator at full urgency without a timeline answer", async () => {
    const { fake, started } = await startedV3Session(
      "raw_v2_operator_token",
      "v2-operator-1",
    );

    const result = await finishInlineQualification(
      {
        sessionToken: started.sessionToken,
        operator: "yes",
        bottleneck: "locations",
        timeline: "",
        invest: "15k_plus",
      },
      { client: fake.client },
    );

    // Gate "yes" = 40 urgency + $15k+ = 60 → 100, same bands as before.
    expect(result).toEqual({
      status: "completed",
      leadId: started.leadId,
      thankYouState: "perfect_fit",
      score: 100,
    });
    expect(fake.state.leads[0]?.qualification_summary).toMatchObject({
      operator_status: "yes",
      bottleneck: "locations",
      persona_key: "OPERATOR",
      qualification_band: "top_closers",
    });
  });

  it("still disqualifies an operator with no capital to deploy", async () => {
    const { fake, started } = await startedV3Session(
      "raw_v2_operator_dq_token",
      "v2-operator-2",
    );

    const result = await finishInlineQualification(
      {
        sessionToken: started.sessionToken,
        operator: "yes",
        bottleneck: "financing",
        timeline: "",
        invest: "no_cash",
      },
      { client: fake.client },
    );

    expect(result.thankYouState).toBe("not_right_time");
    expect(fake.state.leads[0]?.qualification_summary).toMatchObject({
      qualification_band: "disqualify",
    });
  });

  it("requires the bottleneck answer on the operator path", async () => {
    const { fake, started } = await startedV3Session(
      "raw_v2_operator_missing_token",
      "v2-operator-3",
    );

    await expect(
      finishInlineQualification(
        {
          sessionToken: started.sessionToken,
          operator: "yes",
          timeline: "",
          invest: "15k_plus",
        },
        { client: fake.client },
      ),
    ).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ bottleneck: expect.any(Array) }),
    });
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });

  it("walks the standard path and keeps scoring identical to the old funnel", async () => {
    const { fake, started } = await startedV3Session(
      "raw_v2_standard_token",
      "v2-standard-1",
    );

    const result = await finishInlineQualification(
      {
        sessionToken: started.sessionToken,
        operator: "no",
        persona: "escape",
        confidence: "need_roadmap",
        timeline: "few_weeks",
        invest: "5_10k",
      },
      { client: fake.client },
    );

    // few_weeks (30) + $5k-$10k (40) → 70, exactly as before the gate.
    expect(result).toEqual({
      status: "completed",
      leadId: started.leadId,
      thankYouState: "strong_fit",
      score: 70,
    });
    expect(fake.state.leads[0]?.qualification_summary).toMatchObject({
      operator_status: "no",
      persona: "escape",
      confidence: "need_roadmap",
      persona_key: "ESCAPE",
    });
  });

  it("requires persona, confidence, and timeline on the standard path", async () => {
    const { fake, started } = await startedV3Session(
      "raw_v2_standard_missing_token",
      "v2-standard-2",
    );

    await expect(
      finishInlineQualification(
        {
          sessionToken: started.sessionToken,
          operator: "no",
          timeline: "",
          invest: "15k_plus",
        },
        { client: fake.client },
      ),
    ).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({
        persona: expect.any(Array),
        confidence: expect.any(Array),
        timeline: expect.any(Array),
      }),
    });
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });

  it("keeps the legacy timeline+invest contract working against the V3 form", async () => {
    // One-shot callers (page-builder embeds, /vp-quiz) still post only the
    // two scored answers with no gate — they must keep completing.
    const { fake, started } = await startedV3Session(
      "raw_v2_legacy_token",
      "v2-legacy-1",
    );

    const result = await finishInlineQualification(
      {
        sessionToken: started.sessionToken,
        timeline: "asap",
        invest: "15k_plus",
      },
      { client: fake.client },
    );

    expect(result.thankYouState).toBe("perfect_fit");
    expect(result.score).toBe(100);
  });

  it("tells a gate submission against a pre-V2 session to refresh", async () => {
    // Deploy race: the session was started against the old published schema,
    // then the new stepper posts a gate answer the old form cannot store.
    const fake = buildClient();
    const started = await startInlineQualification(
      startInput({ idempotencyKey: "v2-race-1" }),
      { client: fake.client, tokenFactory: () => "raw_v2_race_token" },
    );

    await expect(
      finishInlineQualification(
        {
          sessionToken: started.sessionToken,
          operator: "yes",
          bottleneck: "locations",
          timeline: "",
          invest: "15k_plus",
        },
        { client: fake.client },
      ),
    ).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ session: expect.any(Array) }),
    });
    expect(fake.state.sessions[0]?.status).not.toBe("completed");
  });
});
