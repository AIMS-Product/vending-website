import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QualificationIntakeValidationError,
  createQualificationIntakeSession,
} from "./qualification-intake";
import type { Database, Json } from "@/types/database";

type LeadRow = Database["public"]["Tables"]["lead_submissions"]["Row"];
type QualificationFormRow =
  Database["public"]["Tables"]["qualification_forms"]["Row"];
type QualificationFormVersionRow =
  Database["public"]["Tables"]["qualification_form_versions"]["Row"];
type QualificationSessionRow =
  Database["public"]["Tables"]["qualification_sessions"]["Row"];
type CloseSyncEventRow =
  Database["public"]["Tables"]["close_sync_events"]["Row"];
type IntakeClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  leads: LeadRow[];
  forms: QualificationFormRow[];
  versions: QualificationFormVersionRow[];
  sessions: QualificationSessionRow[];
  events: CloseSyncEventRow[];
  leadUpdates: Array<{ id: string; patch: Record<string, unknown> }>;
};

const baseFormSchema = {
  version: 1,
  questions: [
    {
      id: "state",
      type: "state_region",
      label: "Which state are you focused on?",
      required: true,
      normalizedRole: "state_market",
      options: [{ id: "sa", label: "South Australia", value: "SA" }],
    },
  ],
} as const;

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_existing",
    idempotency_key: "existing-key",
    form_type: "contact",
    status: "received",
    full_name: "Existing Lead",
    email: "buyer@example.com",
    phone: "555-0000",
    city: null,
    state_region: null,
    business_stage: null,
    budget: null,
    timeline: null,
    message: null,
    source_path: "/old",
    landing_path: "/old",
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
    close_lead_id: "close_lead_existing",
    close_contact_id: "close_contact_existing",
    close_sync_status: "synced",
    close_sync_attempt_count: 1,
    close_sync_next_retry_at: null,
    close_sync_last_attempted_at: "2026-06-01T00:00:00.000Z",
    close_sync_synced_at: "2026-06-01T00:01:00.000Z",
    close_sync_last_error: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:01:00.000Z",
    ...overrides,
  };
}

function makeForm(): QualificationFormRow {
  return {
    id: "form_default",
    name: "Default qualification",
    slug: "default-qualification",
    status: "published",
    is_default: true,
    draft_schema: baseFormSchema as unknown as Json,
    current_published_version_id: "version_default_1",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  };
}

function makeVersion(): QualificationFormVersionRow {
  return {
    id: "version_default_1",
    form_id: "form_default",
    version_number: 1,
    schema_snapshot: baseFormSchema as unknown as Json,
    question_count: 1,
    normalized_roles: ["state_market"],
    published_by: null,
    published_at: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  };
}

function buildClient(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    leads: [],
    forms: [makeForm()],
    versions: [makeVersion()],
    sessions: [],
    events: [],
    leadUpdates: [],
    ...initial,
  };

  return {
    state,
    client: {
      from(table: string) {
        return new FakeQuery(table, state);
      },
    } as unknown as IntakeClient,
  };
}

class FakeQuery {
  private filters: Array<{ key: string; value: unknown }> = [];
  private orderKey: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private selectedFields = "";

  constructor(
    private table: string,
    private state: FakeState,
  ) {}

  select(fields = "*") {
    this.selectedFields = fields;
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
    const rows = this.rows();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const rows = this.rows();
    return {
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: "Not found" },
    };
  }

  insert(value: Record<string, unknown>) {
    if (this.table === "lead_submissions") {
      const row = makeLead({
        id: `lead_${this.state.leads.length + 1}`,
        ...value,
      } as Partial<LeadRow>);
      this.state.leads.push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    }

    if (this.table === "qualification_sessions") {
      const inserted = value as Partial<QualificationSessionRow>;
      const defaults: Partial<QualificationSessionRow> = {
        id: `session_${this.state.sessions.length + 1}`,
        answer_count: 0,
        completed_at: null,
        consent_accepted_at: null,
        consent_question_snapshot: null,
        consent_user_agent: null,
        created_at: "2026-06-17T00:00:00.000Z",
        normalized_summary: {},
        status: "pending",
        updated_at: "2026-06-17T00:00:00.000Z",
      };
      const row = { ...defaults, ...inserted } as QualificationSessionRow;
      this.state.sessions.push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    }

    if (this.table === "close_sync_events") {
      const inserted = value as Partial<CloseSyncEventRow>;
      const defaults: Partial<CloseSyncEventRow> = {
        id: `event_${this.state.events.length + 1}`,
        attempt_count: 0,
        close_contact_id: null,
        close_lead_id: null,
        created_at: "2026-06-17T00:00:00.000Z",
        last_attempted_at: null,
        last_error: null,
        max_attempts: 8,
        synced_at: null,
        updated_at: "2026-06-17T00:00:00.000Z",
      };
      const row = { ...defaults, ...inserted } as CloseSyncEventRow;
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
      if (this.table !== "lead_submissions") {
        throw new Error(`Unexpected update to ${this.table}`);
      }
      this.state.leads = this.state.leads.map((row) => {
        if (!this.matches(row)) return row;
        this.state.leadUpdates.push({ id: row.id, patch });
        return { ...row, ...patch } as LeadRow;
      });
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
      | CloseSyncEventRow
    >;

    if (this.table === "lead_submissions") rows = [...this.state.leads];
    else if (this.table === "qualification_forms") rows = [...this.state.forms];
    else if (this.table === "qualification_form_versions") {
      rows = [...this.state.versions];
    } else if (this.table === "qualification_sessions") {
      rows = [...this.state.sessions];
    } else if (this.table === "close_sync_events") {
      rows = [...this.state.events];
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
    if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
    void this.selectedFields;
    return rows;
  }

  private matches(row: object) {
    return this.filters.every(({ key, value }) => {
      return (row as Record<string, unknown>)[key] === value;
    });
  }
}

describe("createQualificationIntakeSession", () => {
  it("requires the short-contact fields before touching Supabase", async () => {
    const fake = buildClient();

    await expect(
      createQualificationIntakeSession(
        { fullName: "", email: "bad", phone: "" },
        { client: fake.client },
      ),
    ).rejects.toBeInstanceOf(QualificationIntakeValidationError);

    expect(fake.state.leads).toHaveLength(0);
    expect(fake.state.sessions).toHaveLength(0);
    expect(fake.state.events).toHaveLength(0);
  });

  it("stores a local lead, creates a tokenized qualification session, and queues Close sync", async () => {
    const fake = buildClient({
      leads: [
        makeLead({
          id: "lead_old",
          idempotency_key: "old-key",
          email: "buyer@example.com",
          close_contact_id: "close_contact_existing",
          close_lead_id: "close_lead_existing",
          created_at: "2026-06-10T00:00:00.000Z",
        }),
      ],
    });

    const result = await createQualificationIntakeSession(
      {
        idempotencyKey: "short-form-1",
        fullName: " New Buyer ",
        email: "BUYER@example.com",
        phone: " 555-0123 ",
        sourcePath: "/resources/start-vending",
        landingPath: "/start-vending",
        referrer: "https://google.example/search",
        userAgent: "vitest",
        sourcePageId: "11111111-1111-4111-8111-111111111111",
        sourcePageSlug: "start-vending",
        targetKeyword: "start vending business",
        sourceBlockId: "lead-block",
        sourceCtaTrackingName: "hero-lead-form",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "launch",
        utmTerm: "vending",
        utmContent: "hero",
        experimentKey: "post_submit_qualification",
        variantKey: "v1",
        completionRedirectPath: "/thanks",
      },
      {
        client: fake.client,
        now: () => new Date("2026-06-17T09:00:00.000Z"),
        tokenFactory: () => "raw_test_token",
      },
    );

    expect(result).toEqual({
      status: "accepted",
      leadId: "lead_2",
      sessionId: "session_1",
      formId: "form_default",
      formVersionId: "version_default_1",
      qualificationUrl: "/qualify/raw_test_token",
      expiresAt: "2026-07-17T09:00:00.000Z",
      staleAt: "2026-06-24T09:00:00.000Z",
    });

    expect(fake.state.leads[1]).toMatchObject({
      idempotency_key: "short-form-1",
      form_type: "contact",
      status: "received",
      lifecycle_status: "qualification_pending",
      full_name: "New Buyer",
      email: "buyer@example.com",
      phone: "555-0123",
      source_path: "/resources/start-vending",
      landing_path: "/start-vending",
      source_page_id: "11111111-1111-4111-8111-111111111111",
      source_block_id: "lead-block",
      source_cta_tracking_name: "hero-lead-form",
      close_contact_id: "close_contact_existing",
      close_lead_id: "close_lead_existing",
      close_sync_status: "pending",
      close_sync_next_retry_at: "2026-06-17T09:00:00.000Z",
    });

    expect(fake.state.sessions[0]).toMatchObject({
      lead_submission_id: "lead_2",
      form_id: "form_default",
      form_version_id: "version_default_1",
      session_token_hash:
        "sha256:a2271de3e10ce6b4cbe0fdf7dad4e4a5bc8aee361b6c64367fe3589940618de8",
      current_question_id: "state",
      status: "pending",
      stale_at: "2026-06-24T09:00:00.000Z",
      expires_at: "2026-07-17T09:00:00.000Z",
      completion_redirect_path: "/thanks",
      experiment_key: "post_submit_qualification",
      variant_key: "v1",
      utm_source: "google",
      utm_medium: "cpc",
    });
    expect(fake.state.sessions[0]?.session_token_hash).not.toContain(
      "raw_test_token",
    );

    expect(fake.state.leadUpdates).toContainEqual({
      id: "lead_2",
      patch: expect.objectContaining({
        latest_qualification_session_id: "session_1",
        latest_qualification_form_id: "form_default",
        latest_qualification_form_version_id: "version_default_1",
        lifecycle_status: "qualification_pending",
      }),
    });

    expect(fake.state.events[0]).toMatchObject({
      lead_submission_id: "lead_2",
      session_id: "session_1",
      event_type: "lead_create_or_update",
      status: "pending",
      close_contact_id: "close_contact_existing",
      close_lead_id: "close_lead_existing",
      dedupe_key: "lead_create_or_update:lead_2:session_1",
      next_retry_at: "2026-06-17T09:00:00.000Z",
      payload: expect.objectContaining({
        qualification: expect.objectContaining({
          formId: "form_default",
          formVersionId: "version_default_1",
          sessionId: "session_1",
        }),
      }),
    });
  });

  it("uses an explicitly resolved page or block qualification form instead of the global default", async () => {
    const fake = buildClient({
      forms: [
        makeForm(),
        {
          ...makeForm(),
          id: "form_block",
          name: "Block qualification",
          current_published_version_id: "version_block_2",
          is_default: false,
        },
      ],
      versions: [
        makeVersion(),
        {
          ...makeVersion(),
          id: "version_block_2",
          form_id: "form_block",
          version_number: 2,
        },
      ],
    });

    const result = await createQualificationIntakeSession(
      {
        idempotencyKey: "short-form-block",
        fullName: "Block Buyer",
        email: "buyer@example.com",
        phone: "555-0123",
        qualificationFormId: "form_block",
      },
      {
        client: fake.client,
        tokenFactory: () => "raw_test_token",
      },
    );

    expect(result).toMatchObject({
      formId: "form_block",
      formVersionId: "version_block_2",
    });
    expect(fake.state.sessions[0]).toMatchObject({
      form_id: "form_block",
      form_version_id: "version_block_2",
    });
  });
});
