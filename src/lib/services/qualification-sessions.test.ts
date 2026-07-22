import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INVEST_OPTIONS } from "@/lib/qualification/scoring";
import {
  completeQualificationSession,
  loadQualificationSessionForToken,
  saveQualificationAnswer,
} from "./qualification-sessions";
import type { Database, Json, Tables } from "@/types/database";

type QualificationSessionRow = Tables<"qualification_sessions">;
type QualificationAnswerRow = Tables<"qualification_answers">;
type QualificationFormVersionRow = Tables<"qualification_form_versions">;
type CloseSyncEventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;
type QualificationSessionClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  sessions: QualificationSessionRow[];
  answers: QualificationAnswerRow[];
  versions: QualificationFormVersionRow[];
  events: CloseSyncEventRow[];
  leads: LeadRow[];
};
type TestFormSchema = {
  version: number;
  questions: ReadonlyArray<{
    readonly [key: string]: unknown;
    normalizedRole?: string;
  }>;
};

const sessionToken = "raw_session_token";
const sessionTokenHash =
  "sha256:8bb10fba5eb551d6793a1760447a543f3f2ba1a7f430bbcf9434008158a76752";

const formSchema = {
  version: 1,
  questions: [
    {
      id: "state",
      type: "state_region",
      label: "Which state are you focused on?",
      required: true,
      normalizedRole: "state_market",
      options: [
        { id: "sa", label: "South Australia", value: "SA" },
        { id: "vic", label: "Victoria", value: "VIC" },
      ],
    },
    {
      id: "budget",
      type: "budget_range",
      label: "How much capital can you access?",
      required: true,
      normalizedRole: "available_capital",
      options: [{ id: "25-50", label: "$25k-$50k", value: "25000-50000" }],
    },
    {
      id: "notes",
      type: "long_text",
      label: "Any other goals or constraints?",
      required: false,
    },
    {
      id: "consent",
      type: "consent",
      label: "I agree to be contacted about my vending enquiry.",
      required: true,
      normalizedRole: "consent",
    },
  ],
} as const;

function makeVersion(
  schema: TestFormSchema = formSchema,
): QualificationFormVersionRow {
  return {
    id: "version_1",
    form_id: "form_1",
    version_number: 1,
    schema_snapshot: schema as unknown as Json,
    question_count: schema.questions.length,
    normalized_roles: schema.questions
      .map((question) => question.normalizedRole)
      .filter((role): role is string => Boolean(role)),
    published_by: null,
    published_at: "2026-06-17T08:00:00.000Z",
    created_at: "2026-06-17T08:00:00.000Z",
  };
}

function makeSession(
  overrides: Partial<QualificationSessionRow> = {},
): QualificationSessionRow {
  return {
    id: "session_1",
    lead_submission_id: "lead_1",
    form_id: "form_1",
    form_version_id: "version_1",
    session_token_hash: sessionTokenHash,
    status: "pending",
    completion_redirect_path: "/thanks",
    source_path: "/start",
    landing_path: "/start",
    referrer: "https://google.example/search",
    user_agent: "vitest",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "launch",
    utm_term: null,
    utm_content: null,
    source_page_id: "11111111-1111-4111-8111-111111111111",
    source_page_slug: "start-vending",
    source_block_id: "lead-block",
    source_cta_tracking_name: "hero-lead-form",
    target_keyword: "start vending business",
    experiment_key: "post_submit_qualification",
    variant_key: "v1",
    current_question_id: "state",
    answer_count: 0,
    normalized_summary: {},
    consent_accepted_at: null,
    consent_question_snapshot: null,
    consent_user_agent: null,
    consent_source_attribution: {},
    stale_at: "2026-06-24T09:00:00.000Z",
    // Far-future so happy-path tests that rely on the real clock (no injected
    // `now`) never see the default session as expired. Expiry behaviour is
    // covered by tests that override `expires_at` + pass a matching `now`.
    expires_at: "2999-07-17T09:00:00.000Z",
    started_at: "2026-06-17T09:00:00.000Z",
    completed_at: null,
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:00:00.000Z",
    ...overrides,
  };
}

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
    source_path: "/start",
    landing_path: "/start",
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
    lifecycle_status: "qualification_pending",
    qualification_summary: {},
    latest_qualification_form_id: "form_1",
    latest_qualification_form_version_id: "version_1",
    latest_qualification_session_id: "session_1",
    latest_qualification_started_at: "2026-06-17T09:00:00.000Z",
    latest_qualification_completed_at: null,
    close_lead_id: "close_lead_1",
    close_contact_id: "close_contact_1",
    close_sync_status: "pending",
    close_sync_attempt_count: 0,
    close_sync_next_retry_at: "2026-06-17T09:00:00.000Z",
    close_sync_last_attempted_at: null,
    close_sync_synced_at: null,
    close_sync_last_error: null,
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:00:00.000Z",
    ...overrides,
  };
}

function buildClient(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    sessions: [makeSession()],
    answers: [],
    versions: [makeVersion()],
    events: [],
    leads: [makeLead()],
    ...initial,
  };

  return {
    state,
    client: {
      from(table: string) {
        return new FakeQuery(table, state);
      },
    } as unknown as QualificationSessionClient,
  };
}

class FakeQuery {
  private filters: Array<{ key: string; value: unknown }> = [];
  private orderKey: string | null = null;
  private orderAscending = true;

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

  async maybeSingle() {
    return { data: this.rows()[0] ?? null, error: null };
  }

  async single() {
    const row = this.rows()[0] ?? null;
    return { data: row, error: row ? null : { message: "Not found" } };
  }

  insert(value: Record<string, unknown>) {
    if (this.table === "qualification_answers") {
      const defaults: Partial<QualificationAnswerRow> = {
        id: `answer_${this.state.answers.length + 1}`,
        created_at: "2026-06-17T09:00:00.000Z",
        updated_at: "2026-06-17T09:00:00.000Z",
        answered_at: "2026-06-17T09:00:00.000Z",
        option_snapshots: [],
        normalized_value: {},
      };
      const row = {
        ...defaults,
        ...(value as Partial<QualificationAnswerRow>),
      } as QualificationAnswerRow;
      this.state.answers.push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    }

    if (this.table === "close_sync_events") {
      const defaults: Partial<CloseSyncEventRow> = {
        id: `event_${this.state.events.length + 1}`,
        attempt_count: 0,
        close_contact_id: null,
        close_lead_id: null,
        created_at: "2026-06-17T09:00:00.000Z",
        dedupe_key: null,
        last_attempted_at: null,
        last_error: null,
        max_attempts: 8,
        next_retry_at: "2026-06-17T09:00:00.000Z",
        payload: {},
        synced_at: null,
        updated_at: "2026-06-17T09:00:00.000Z",
      };
      const row = {
        ...defaults,
        ...(value as Partial<CloseSyncEventRow>),
      } as CloseSyncEventRow;
      this.state.events.push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    }

    throw new Error(`Unexpected insert into ${this.table}`);
  }

  update(patch: Record<string, unknown>) {
    const apply = async () => {
      if (this.table === "qualification_sessions") {
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
      } else if (this.table === "lead_submissions") {
        this.state.leads = this.state.leads.map((row) =>
          this.matches(row) ? ({ ...row, ...patch } as LeadRow) : row,
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

  then(resolve: (value: { data: unknown[]; error: null }) => void) {
    resolve({ data: this.rows(), error: null });
  }

  private rows() {
    let rows: Array<
      | QualificationSessionRow
      | QualificationAnswerRow
      | QualificationFormVersionRow
      | CloseSyncEventRow
      | LeadRow
    >;

    if (this.table === "qualification_sessions") {
      rows = [...this.state.sessions];
    } else if (this.table === "qualification_answers") {
      rows = [...this.state.answers];
    } else if (this.table === "qualification_form_versions") {
      rows = [...this.state.versions];
    } else if (this.table === "close_sync_events") {
      rows = [...this.state.events];
    } else if (this.table === "lead_submissions") {
      rows = [...this.state.leads];
    } else {
      rows = [];
    }

    rows = rows.filter((row) => this.matches(row));
    if (this.orderKey) {
      rows.sort((a, b) => {
        const av = (a as Record<string, unknown>)[this.orderKey!];
        const bv = (b as Record<string, unknown>)[this.orderKey!];
        const compared = String(av ?? "").localeCompare(String(bv ?? ""));
        return this.orderAscending ? compared : -compared;
      });
    }
    return rows;
  }

  private matches(row: object) {
    return this.filters.every(({ key, value }) => {
      return (row as Record<string, unknown>)[key] === value;
    });
  }
}

describe("qualification sessions", () => {
  it("loads a valid token without exposing PII and reports unknown or expired tokens as unavailable", async () => {
    const fake = buildClient();

    const loaded = await loadQualificationSessionForToken(
      { sessionToken },
      {
        client: fake.client,
        now: () => new Date("2026-06-17T10:00:00.000Z"),
      },
    );

    expect(loaded).toMatchObject({
      status: "active",
      sessionId: "session_1",
      formVersionId: "version_1",
      currentQuestionId: "state",
      answers: {},
    });
    expect(JSON.stringify(loaded)).not.toContain("buyer@example.com");
    expect(JSON.stringify(loaded)).not.toContain("lead_1");

    const unknown = await loadQualificationSessionForToken(
      { sessionToken: "missing" },
      { client: fake.client },
    );
    expect(unknown).toEqual({ status: "unavailable", reason: "not_found" });

    const expired = buildClient({
      sessions: [makeSession({ expires_at: "2026-06-16T09:00:00.000Z" })],
    });
    await expect(
      loadQualificationSessionForToken(
        { sessionToken },
        {
          client: expired.client,
          now: () => new Date("2026-06-17T10:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({ status: "unavailable", reason: "expired" });

    const exactlyExpired = buildClient({
      sessions: [makeSession({ expires_at: "2026-06-17T10:00:00.000Z" })],
    });
    await expect(
      loadQualificationSessionForToken(
        { sessionToken },
        {
          client: exactlyExpired.client,
          now: () => new Date("2026-06-17T10:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({ status: "unavailable", reason: "expired" });
  });

  it("maps completed sessions with saved answers and default redirects", async () => {
    const completed = buildClient({
      sessions: [
        makeSession({
          status: "completed",
          current_question_id: "state",
          completed_at: "2026-06-17T11:00:00.000Z",
          completion_redirect_path: null,
        }),
      ],
      answers: [
        {
          id: "answer_1",
          session_id: "session_1",
          lead_submission_id: "lead_1",
          form_version_id: "version_1",
          question_id: "state",
          question_type: "state_region",
          normalized_role: "state_market",
          question_snapshot: {
            id: "state",
            label: "Which state are you focused on?",
            type: "state_region",
          },
          option_snapshots: [{ id: "sa", label: "South Australia" }],
          answer_value: "SA",
          normalized_value: { state_market: "SA" },
          answered_at: "2026-06-17T10:00:00.000Z",
          created_at: "2026-06-17T10:00:00.000Z",
          updated_at: "2026-06-17T10:00:00.000Z",
        },
      ],
    });

    await expect(
      loadQualificationSessionForToken(
        { sessionToken },
        {
          client: completed.client,
          now: () => new Date("2026-06-17T12:00:00.000Z"),
        },
      ),
    ).resolves.toMatchObject({
      status: "completed",
      currentQuestionId: null,
      answers: { state: "SA" },
      completedAt: "2026-06-17T11:00:00.000Z",
      redirectPath: "/thank-you",
    });
  });

  it("autosaves answer snapshots, normalized values, and resume state, and can edit prior answers", async () => {
    const fake = buildClient();

    const firstSave = await saveQualificationAnswer(
      {
        sessionToken,
        questionId: "state",
        answerValue: "SA",
      },
      {
        client: fake.client,
        now: () => new Date("2026-06-17T10:00:00.000Z"),
      },
    );

    expect(firstSave).toEqual({
      status: "saved",
      sessionId: "session_1",
      questionId: "state",
      currentQuestionId: "budget",
      answerCount: 1,
    });
    expect(fake.state.answers).toHaveLength(1);
    expect(fake.state.answers[0]).toMatchObject({
      session_id: "session_1",
      lead_submission_id: "lead_1",
      form_version_id: "version_1",
      question_id: "state",
      question_type: "state_region",
      answer_value: "SA",
      normalized_role: "state_market",
      normalized_value: { state_market: "SA" },
      option_snapshots: [{ id: "sa", label: "South Australia", value: "SA" }],
    });
    expect(fake.state.answers[0]?.question_snapshot).toMatchObject({
      id: "state",
      label: "Which state are you focused on?",
      type: "state_region",
    });
    expect(fake.state.sessions[0]).toMatchObject({
      status: "in_progress",
      answer_count: 1,
      current_question_id: "budget",
    });

    const secondSave = await saveQualificationAnswer(
      {
        sessionToken,
        questionId: "state",
        answerValue: "VIC",
      },
      {
        client: fake.client,
        now: () => new Date("2026-06-17T10:05:00.000Z"),
      },
    );

    expect(secondSave).toEqual({
      status: "saved",
      sessionId: "session_1",
      questionId: "state",
      currentQuestionId: "budget",
      answerCount: 1,
    });
    expect(fake.state.answers).toHaveLength(1);
    expect(fake.state.answers[0]).toMatchObject({
      answer_value: "VIC",
      normalized_value: { state_market: "VIC" },
      option_snapshots: [{ id: "vic", label: "Victoria", value: "VIC" }],
    });
    expect(fake.state.sessions[0]?.answer_count).toBe(1);
  });

  it("rejects missing sessions, expired sessions, and unknown questions when saving", async () => {
    const fake = buildClient();

    await expect(
      saveQualificationAnswer(
        { sessionToken: "missing", questionId: "state", answerValue: "SA" },
        { client: fake.client },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { session: ["Qualification session was not found."] },
    });

    const expired = buildClient({
      sessions: [makeSession({ expires_at: "2026-06-16T09:00:00.000Z" })],
    });
    await expect(
      saveQualificationAnswer(
        { sessionToken, questionId: "state", answerValue: "SA" },
        {
          client: expired.client,
          now: () => new Date("2026-06-17T10:00:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { session: ["Qualification session has expired."] },
    });

    await expect(
      saveQualificationAnswer(
        { sessionToken, questionId: "missing", answerValue: "SA" },
        { client: fake.client },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { missing: ["Question was not found."] },
    });
  });

  it("requires all required answers and consent before completion", async () => {
    const fake = buildClient();
    await saveQualificationAnswer(
      { sessionToken, questionId: "state", answerValue: "SA" },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "budget", answerValue: "25-50" },
      { client: fake.client },
    );

    await expect(
      completeQualificationSession({ sessionToken }, { client: fake.client }),
    ).rejects.toMatchObject({
      fieldErrors: { consent: ["Consent is required."] },
    });
  });

  it("does not complete with blank required answers", async () => {
    const fake = buildClient();
    await saveQualificationAnswer(
      { sessionToken, questionId: "state", answerValue: "SA" },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "budget", answerValue: "" },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "consent", answerValue: true },
      { client: fake.client },
    );

    await expect(
      completeQualificationSession({ sessionToken }, { client: fake.client }),
    ).rejects.toMatchObject({
      fieldErrors: {
        budget: ["How much capital can you access? is required."],
      },
    });
  });

  it("completes once, enqueues Close enrichment, and rejects unsafe redirects", async () => {
    const fake = buildClient();

    await saveQualificationAnswer(
      { sessionToken, questionId: "state", answerValue: "SA" },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "budget", answerValue: "25-50" },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "notes", answerValue: 42 },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "consent", answerValue: true },
      { client: fake.client },
    );

    const completed = await completeQualificationSession(
      { sessionToken, userAgent: "vitest" },
      {
        client: fake.client,
        now: () => new Date("2026-06-17T11:00:00.000Z"),
      },
    );

    expect(completed).toEqual({
      status: "completed",
      redirectPath: "/thanks",
      sessionId: "session_1",
    });
    expect(fake.state.sessions[0]).toMatchObject({
      status: "completed",
      completed_at: "2026-06-17T11:00:00.000Z",
      current_question_id: null,
      answer_count: 4,
      normalized_summary: {
        state_market: "SA",
        available_capital: "25000-50000",
        consent: true,
      },
      consent_accepted_at: "2026-06-17T11:00:00.000Z",
      consent_user_agent: "vitest",
    });
    expect(fake.state.leads[0]).toMatchObject({
      lifecycle_status: "qualified",
      latest_qualification_completed_at: "2026-06-17T11:00:00.000Z",
      qualification_summary: {
        state_market: "SA",
        available_capital: "25000-50000",
        consent: true,
      },
      close_sync_status: "pending",
      close_sync_next_retry_at: "2026-06-17T11:00:00.000Z",
    });
    expect(fake.state.events).toHaveLength(1);
    expect(fake.state.events[0]).toMatchObject({
      event_type: "qualification_enrichment",
      status: "pending",
      lead_submission_id: "lead_1",
      session_id: "session_1",
      close_lead_id: "close_lead_1",
      close_contact_id: "close_contact_1",
      dedupe_key: "qualification_enrichment:session_1",
    });
    const payload = fake.state.events[0]?.payload as Record<string, unknown>;
    expect(payload.source).toBe("qualification_completion");
    expect(payload.qualification).toEqual({
      status: "qualified",
      sessionId: "session_1",
      formId: "form_1",
      formVersionId: "version_1",
      completedAt: "2026-06-17T11:00:00.000Z",
      experimentKey: "post_submit_qualification",
      variantKey: "v1",
      // Non-A/B variant + no timeline answer → not a scoring form, so the
      // score fields ride along as null.
      score: null,
      band: null,
      thankYouState: null,
      disqualified: null,
    });
    expect(payload.attribution).toEqual({
      source_path: "/start",
      landing_path: "/start",
      referrer: "https://google.example/search",
      source_page_id: "11111111-1111-4111-8111-111111111111",
      source_page_slug: "start-vending",
      source_block_id: "lead-block",
      source_cta_tracking_name: "hero-lead-form",
      target_keyword: "start vending business",
      user_agent: "vitest",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "launch",
      utm_term: null,
      utm_content: null,
      experiment_key: "post_submit_qualification",
      variant_key: "v1",
    });
    expect(payload.normalized).toEqual({
      state_market: "SA",
      available_capital: "25000-50000",
      consent: true,
    });
    expect(payload.answers).toEqual([
      {
        questionId: "state",
        questionType: "state_region",
        normalizedRole: "state_market",
        label: "Which state are you focused on?",
        value: "SA",
        normalizedValue: { state_market: "SA" },
      },
      {
        questionId: "budget",
        questionType: "budget_range",
        normalizedRole: "available_capital",
        label: "How much capital can you access?",
        value: "25-50",
        normalizedValue: { available_capital: "25000-50000" },
      },
      {
        questionId: "notes",
        questionType: "long_text",
        normalizedRole: null,
        label: "Any other goals or constraints?",
        value: "42",
        normalizedValue: {},
      },
      {
        questionId: "consent",
        questionType: "consent",
        normalizedRole: "consent",
        label: "I agree to be contacted about my vending enquiry.",
        value: "true",
        normalizedValue: { consent: true },
      },
    ]);

    const completedAgain = await completeQualificationSession(
      { sessionToken },
      { client: fake.client },
    );
    expect(completedAgain).toEqual({
      status: "completed",
      sessionId: "session_1",
      redirectPath: "/thanks",
    });
    expect(fake.state.events).toHaveLength(1);

    const unsafe = buildClient({
      sessions: [
        makeSession({
          completion_redirect_path: "https://evil.example/phish",
        }),
      ],
    });
    await saveQualificationAnswer(
      { sessionToken, questionId: "state", answerValue: "SA" },
      { client: unsafe.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "budget", answerValue: "25-50" },
      { client: unsafe.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "consent", answerValue: true },
      { client: unsafe.client },
    );
    await expect(
      completeQualificationSession({ sessionToken }, { client: unsafe.client }),
    ).resolves.toMatchObject({ redirectPath: "/thank-you" });

    const protocolRelative = buildClient({
      sessions: [
        makeSession({
          completion_redirect_path: "//evil.example/phish",
        }),
      ],
    });
    await saveQualificationAnswer(
      { sessionToken, questionId: "state", answerValue: "SA" },
      { client: protocolRelative.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "budget", answerValue: "25-50" },
      { client: protocolRelative.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "consent", answerValue: true },
      { client: protocolRelative.client },
    );
    await expect(
      completeQualificationSession(
        { sessionToken },
        { client: protocolRelative.client },
      ),
    ).resolves.toMatchObject({ redirectPath: "/thank-you" });
  });

  it("treats numbers, arrays, and objects as required answers but rejects empty objects and null", async () => {
    const schema = {
      version: 1,
      questions: [
        {
          id: "number",
          type: "short_text",
          label: "Numeric answer",
          required: true,
        },
        {
          id: "array",
          type: "short_text",
          label: "Array answer",
          required: true,
        },
        {
          id: "object",
          type: "short_text",
          label: "Object answer",
          required: true,
        },
        {
          id: "consent",
          type: "consent",
          label: "Consent",
          required: true,
          normalizedRole: "consent",
        },
      ],
    } as const;
    const fake = buildClient({ versions: [makeVersion(schema)] });

    await saveQualificationAnswer(
      { sessionToken, questionId: "number", answerValue: 0 },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "array", answerValue: ["", "ready"] },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "object", answerValue: { ready: true } },
      { client: fake.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "consent", answerValue: true },
      { client: fake.client },
    );

    expect(fake.state.answers).toEqual([
      expect.objectContaining({ question_id: "number", answer_value: 0 }),
      expect.objectContaining({
        question_id: "array",
        answer_value: ["", "ready"],
      }),
      expect.objectContaining({
        question_id: "object",
        answer_value: { ready: true },
      }),
      expect.objectContaining({ question_id: "consent", answer_value: true }),
    ]);

    await expect(
      completeQualificationSession({ sessionToken }, { client: fake.client }),
    ).resolves.toMatchObject({ status: "completed" });

    const blank = buildClient({ versions: [makeVersion(schema)] });
    await saveQualificationAnswer(
      { sessionToken, questionId: "number", answerValue: null },
      { client: blank.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "array", answerValue: [] },
      { client: blank.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "object", answerValue: {} },
      { client: blank.client },
    );
    await saveQualificationAnswer(
      { sessionToken, questionId: "consent", answerValue: false },
      { client: blank.client },
    );

    await expect(
      completeQualificationSession({ sessionToken }, { client: blank.client }),
    ).rejects.toMatchObject({
      fieldErrors: {
        number: ["Numeric answer is required."],
        array: ["Array answer is required."],
        object: ["Object answer is required."],
        consent: ["Consent is required."],
      },
    });
  });

  it("scores a completed A/B session and routes it to the fit thank-you state", async () => {
    const scoringSchema = {
      version: 1,
      questions: [
        {
          id: "timeline",
          type: "single_choice",
          label: "When do you want your first machine placed?",
          required: true,
          normalizedRole: "timeline",
          options: [
            { id: "asap", label: "As soon as possible", value: "asap" },
            { id: "unsure", label: "Still figuring", value: "unsure" },
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
            { id: "lt_3k", label: "Less than $3,000", value: "lt_3k" },
          ],
        },
        {
          id: "consent",
          type: "consent",
          label: "I agree to be contacted.",
          required: true,
          normalizedRole: "consent",
        },
      ],
    } as const;

    const fake = buildClient({
      versions: [makeVersion(scoringSchema)],
      sessions: [makeSession({ variant_key: "A" })],
      leads: [makeLead()],
      answers: [
        makeScoringAnswer("timeline", "timeline", "asap"),
        makeScoringAnswer("invest", "available_capital", "15k_plus"),
        {
          ...makeScoringAnswer("consent", "consent", true),
          answer_value: true as unknown as Json,
        },
      ],
    });

    const completed = await completeQualificationSession(
      { sessionToken, userAgent: "vitest" },
      { client: fake.client, now: () => new Date("2026-06-17T11:00:00.000Z") },
    );

    // asap (40) + $15k+ (60) = 100 → perfect fit / top closers.
    expect(completed.redirectPath).toBe(
      "/thank-you?state=perfect_fit&score=100",
    );
    expect(fake.state.leads[0]?.qualification_summary).toMatchObject({
      qualification_score: 100,
      qualification_band: "top_closers",
      qualification_thank_you_state: "perfect_fit",
    });
    const payload = fake.state.events[0]?.payload as Record<string, unknown>;
    expect(payload.qualification).toMatchObject({
      score: 100,
      band: "top_closers",
      thankYouState: "perfect_fit",
      disqualified: false,
    });
  });
});

describe("A/B invest variant rendering", () => {
  const investSchema = {
    version: 1,
    questions: [
      {
        id: "invest",
        type: "single_choice",
        label: "How much are you ready to invest?",
        required: true,
        normalizedRole: "available_capital",
        options: [
          { id: "lt_3k", label: "Less than $3,000", value: "lt_3k" },
          { id: "15k_plus", label: "$15,000+", value: "15k_plus" },
        ],
      },
    ],
  } as const;

  it("swaps the seeded (Variant A) invest options for Variant B sessions", async () => {
    const fake = buildClient({
      versions: [makeVersion(investSchema)],
      sessions: [makeSession({ variant_key: "B" })],
    });

    const view = await loadQualificationSessionForToken(
      { sessionToken },
      { client: fake.client },
    );
    if (view.status !== "active") throw new Error("expected active session");
    const invest = view.questions.find((q) => q.id === "invest");
    expect(invest?.options?.map((o) => o.value)).toEqual(
      INVEST_OPTIONS.B.map((o) => o.value),
    );
  });

  it("keeps the seeded (Variant A) invest options for Variant A sessions", async () => {
    const fake = buildClient({
      versions: [makeVersion(investSchema)],
      sessions: [makeSession({ variant_key: "A" })],
    });

    const view = await loadQualificationSessionForToken(
      { sessionToken },
      { client: fake.client },
    );
    if (view.status !== "active") throw new Error("expected active session");
    const invest = view.questions.find((q) => q.id === "invest");
    expect(invest?.options?.map((o) => o.value)).toEqual(
      INVEST_OPTIONS.A.map((o) => o.value),
    );
  });
});

function makeScoringAnswer(
  questionId: string,
  role: string,
  value: Json,
): QualificationAnswerRow {
  return {
    id: `answer_${questionId}`,
    session_id: "session_1",
    lead_submission_id: "lead_1",
    form_version_id: "version_1",
    question_id: questionId,
    question_type: role === "consent" ? "consent" : "single_choice",
    normalized_role: role,
    question_snapshot: {},
    option_snapshots: [],
    answer_value: value,
    normalized_value: role === "consent" ? {} : { [role]: value },
    answered_at: "2026-06-17T10:00:00.000Z",
    created_at: "2026-06-17T10:00:00.000Z",
    updated_at: "2026-06-17T10:00:00.000Z",
  } as unknown as QualificationAnswerRow;
}
