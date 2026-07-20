import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminDeleteLead,
  adminGetLeadDetail,
  adminListLeads,
  adminRetryCloseSyncEvent,
  LeadAdminServiceError,
} from "./lead-admin";
import type { Database, Tables } from "@/types/database";

type LeadRow = Tables<"lead_submissions">;
type SessionRow = Tables<"qualification_sessions">;
type AnswerRow = Tables<"qualification_answers">;
type EventRow = Tables<"close_sync_events">;
type LeadAdminClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  leads: LeadRow[];
  sessions: SessionRow[];
  answers: AnswerRow[];
  events: EventRow[];
  updates: Array<{
    table: string;
    id: string;
    patch: Record<string, unknown>;
  }>;
};

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_1",
    idempotency_key: "lead-key-1",
    form_type: "contact",
    status: "received",
    full_name: "Jane Buyer",
    email: "buyer@example.com",
    phone: "555-0101",
    city: null,
    state_region: "SA",
    business_stage: null,
    budget: null,
    timeline: null,
    message: null,
    source_path: "/resources/vending-machine-cost",
    landing_path: "/resources/vending-machine-cost",
    referrer: null,
    user_agent: null,
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "starter-kit",
    utm_term: null,
    utm_content: "hero",
    source_page_id: "page_1",
    source_page_slug: "vending-machine-cost",
    target_keyword: "vending machine cost",
    source_block_id: "lead_block_1",
    source_cta_tracking_name: "hero-lead-form",
    metadata: {
      attribution_session: {
        vp_session_id: "vp-session-1",
        first_landing_path: "/resources/vending-machine-cost",
        latest_landing_path: "/apply",
        clicked_href: "/apply",
      },
      paid_attribution: {
        paid_platform: "google_ads",
        paid_source_key: "google_ads:camp-1:group-1:ad-1",
        campaign_id: "camp-1",
        ad_group_id: "group-1",
        group_id: "group-1",
        ad_id: "ad-1",
        gclid: "gclid-1",
      },
    },
    notification_attempted_at: null,
    notification_sent_at: null,
    notification_error: null,
    lifecycle_status: "qualification_pending",
    qualification_summary: {
      status: "qualification_pending",
      state_market: "SA",
    },
    latest_qualification_form_id: "form_1",
    latest_qualification_form_version_id: "version_1",
    latest_qualification_session_id: "session_1",
    latest_qualification_started_at: "2026-06-17T09:00:00.000Z",
    latest_qualification_completed_at: null,
    close_lead_id: null,
    close_contact_id: null,
    close_sync_status: "failed",
    close_sync_attempt_count: 2,
    close_sync_next_retry_at: "2026-06-17T09:05:00.000Z",
    close_sync_last_attempted_at: "2026-06-17T09:00:00.000Z",
    close_sync_synced_at: null,
    close_sync_last_error: "Close API key is not configured.",
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:05:00.000Z",
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "session_1",
    lead_submission_id: "lead_1",
    form_id: "form_1",
    form_version_id: "version_1",
    session_token_hash: "sha256:token",
    status: "in_progress",
    completion_redirect_path: "/thank-you",
    source_path: "/resources/vending-machine-cost",
    landing_path: "/resources/vending-machine-cost",
    referrer: null,
    user_agent: null,
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "starter-kit",
    utm_term: null,
    utm_content: "hero",
    source_page_id: "page_1",
    source_page_slug: "vending-machine-cost",
    source_block_id: "lead_block_1",
    source_cta_tracking_name: "hero-lead-form",
    target_keyword: "vending machine cost",
    experiment_key: "pricing-page",
    variant_key: "hero-a",
    current_question_id: "budget",
    answer_count: 1,
    normalized_summary: { state_market: "SA" },
    consent_accepted_at: null,
    consent_question_snapshot: null,
    consent_user_agent: null,
    consent_source_attribution: {},
    stale_at: "2026-06-24T09:00:00.000Z",
    expires_at: "2026-07-17T09:00:00.000Z",
    started_at: "2026-06-17T09:00:00.000Z",
    completed_at: null,
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:05:00.000Z",
    ...overrides,
  };
}

function makeAnswer(overrides: Partial<AnswerRow> = {}): AnswerRow {
  return {
    id: "answer_1",
    session_id: "session_1",
    lead_submission_id: "lead_1",
    form_version_id: "version_1",
    question_id: "state",
    question_type: "state_region",
    normalized_role: "state_market",
    question_snapshot: {
      id: "state",
      label: "Which state or market are you focused on?",
      type: "state_region",
    },
    option_snapshots: [{ id: "sa", label: "South Australia", value: "SA" }],
    answer_value: "SA",
    normalized_value: "SA",
    answered_at: "2026-06-17T09:02:00.000Z",
    created_at: "2026-06-17T09:02:00.000Z",
    updated_at: "2026-06-17T09:02:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "event_1",
    lead_submission_id: "lead_1",
    session_id: "session_1",
    event_type: "lead_create_or_update",
    status: "failed",
    dedupe_key: "lead_create_or_update:lead_1:session_1",
    payload: { contact: { email: "buyer@example.com" } },
    close_lead_id: null,
    close_contact_id: null,
    attempt_count: 2,
    max_attempts: 8,
    next_retry_at: "2026-06-17T09:05:00.000Z",
    last_attempted_at: "2026-06-17T09:00:00.000Z",
    synced_at: null,
    last_error: "Close API key is not configured.",
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:05:00.000Z",
    ...overrides,
  };
}

function buildClient(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    leads: [makeLead()],
    sessions: [makeSession()],
    answers: [makeAnswer()],
    events: [makeEvent()],
    updates: [],
    ...initial,
  };

  return {
    state,
    client: {
      from(table: string) {
        return new FakeQuery(table, state);
      },
    } as unknown as LeadAdminClient,
  };
}

class FakeQuery {
  private filters: Array<{
    key: string;
    value: unknown;
    op: "eq" | "in";
  }> = [];
  private orderKey: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private deleteMode = false;

  constructor(
    private table: string,
    private state: FakeState,
  ) {}

  select() {
    return this;
  }

  delete() {
    this.deleteMode = true;
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value, op: "eq" });
    return this;
  }

  in(key: string, value: unknown[]) {
    this.filters.push({ key, value, op: "in" });
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

  update(patch: Record<string, unknown>) {
    const apply = async () => {
      const idFilter = this.filters.find((filter) => filter.key === "id");
      if (!idFilter || idFilter.op !== "eq") {
        return { data: null, error: { message: "Missing id filter" } };
      }
      if (this.table === "close_sync_events") {
        this.state.events = this.state.events.map((row) =>
          row.id === idFilter.value
            ? this.updatedRow(row, patch, this.table)
            : row,
        );
      } else if (this.table === "lead_submissions") {
        this.state.leads = this.state.leads.map((row) =>
          row.id === idFilter.value
            ? this.updatedRow(row, patch, this.table)
            : row,
        );
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
    if (this.deleteMode) {
      const matched = this.rows();
      if (this.table === "lead_submissions") {
        const ids = new Set(matched.map((row) => (row as LeadRow).id));
        this.state.leads = this.state.leads.filter((row) => !ids.has(row.id));
      }
      resolve({ data: matched, error: null });
      return;
    }
    resolve({ data: this.rows(), error: null });
  }

  private rows() {
    let rows: Array<LeadRow | SessionRow | AnswerRow | EventRow>;
    if (this.table === "lead_submissions") rows = [...this.state.leads];
    else if (this.table === "qualification_sessions") {
      rows = [...this.state.sessions];
    } else if (this.table === "qualification_answers") {
      rows = [...this.state.answers];
    } else if (this.table === "close_sync_events") {
      rows = [...this.state.events];
    } else {
      throw new Error(`Unexpected table ${this.table}`);
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
    return rows;
  }

  private matches(row: object) {
    return this.filters.every(({ key, op, value }) => {
      const actual = (row as Record<string, unknown>)[key];
      return op === "eq"
        ? actual === value
        : Array.isArray(value) && value.includes(actual);
    });
  }

  private updatedRow<Row extends { id: string }>(
    row: Row,
    patch: Record<string, unknown>,
    table: string,
  ): Row {
    this.state.updates.push({ table, id: row.id, patch });
    return { ...row, ...patch };
  }
}

describe("adminListLeads", () => {
  it("lists lead identity, lifecycle, sync, source, UTM, variant, and qualification state", async () => {
    const fake = buildClient();

    await expect(adminListLeads({ client: fake.client })).resolves.toEqual([
      expect.objectContaining({
        id: "lead_1",
        fullName: "Jane Buyer",
        email: "buyer@example.com",
        lifecycleStatus: "qualification_pending",
        qualificationStatus: "in_progress",
        closeSyncStatus: "failed",
        sourcePath: "/resources/vending-machine-cost",
        vpSessionId: "vp-session-1",
        paidSourceKey: "google_ads:camp-1:group-1:ad-1",
        adId: "ad-1",
        utmSource: "google",
        experimentKey: "pricing-page",
        variantKey: "hero-a",
        latestCloseSyncEvent: expect.objectContaining({
          id: "event_1",
          status: "failed",
          lastError: "Close API key is not configured.",
        }),
      }),
    ]);
  });

  it("filters by lifecycle and Close sync status", async () => {
    const fake = buildClient({
      leads: [
        makeLead({ id: "lead_1", lifecycle_status: "qualification_pending" }),
        makeLead({
          id: "lead_2",
          email: "synced@example.com",
          lifecycle_status: "qualified",
          close_sync_status: "synced",
        }),
      ],
    });

    await expect(
      adminListLeads({
        lifecycleStatus: "qualification_pending",
        closeSyncStatus: "failed",
        client: fake.client,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: "lead_1" })]);
  });
});

describe("adminGetLeadDetail", () => {
  it("loads answer snapshots, normalized summary, and Close sync events for one lead", async () => {
    const fake = buildClient();

    await expect(
      adminGetLeadDetail({ leadId: "lead_1" }, { client: fake.client }),
    ).resolves.toMatchObject({
      id: "lead_1",
      fullName: "Jane Buyer",
      sessions: [
        expect.objectContaining({
          id: "session_1",
          status: "in_progress",
          normalizedSummary: { state_market: "SA" },
        }),
      ],
      answers: [
        expect.objectContaining({
          questionLabel: "Which state or market are you focused on?",
          displayValue: "SA",
          normalizedRole: "state_market",
        }),
      ],
      closeSyncEvents: [
        expect.objectContaining({
          id: "event_1",
          status: "failed",
          eventType: "lead_create_or_update",
        }),
      ],
    });
  });
});

describe("adminRetryCloseSyncEvent", () => {
  it("requeues a failed event without creating a duplicate event", async () => {
    const fake = buildClient();

    await adminRetryCloseSyncEvent(
      { eventId: "event_1" },
      {
        client: fake.client,
        now: () => new Date("2026-06-17T10:00:00.000Z"),
      },
    );

    expect(fake.state.events).toHaveLength(1);
    expect(fake.state.events[0]).toMatchObject({
      id: "event_1",
      status: "pending",
      next_retry_at: "2026-06-17T10:00:00.000Z",
      last_error: null,
    });
    expect(fake.state.leads[0]).toMatchObject({
      close_sync_status: "pending",
      close_sync_next_retry_at: "2026-06-17T10:00:00.000Z",
      close_sync_last_error: null,
    });
  });

  it("blocks retries for already synced events", async () => {
    const fake = buildClient({
      events: [
        makeEvent({ status: "synced", synced_at: "2026-06-17T09:10:00.000Z" }),
      ],
    });

    await expect(
      adminRetryCloseSyncEvent({ eventId: "event_1" }, { client: fake.client }),
    ).rejects.toThrow("Synced Close events cannot be retried.");

    expect(fake.state.updates).toEqual([]);
  });
});

describe("adminDeleteLead", () => {
  it("permanently removes the lead and reports the deleted id", async () => {
    const fake = buildClient({
      leads: [makeLead({ id: "lead_1" }), makeLead({ id: "lead_2" })],
    });

    const result = await adminDeleteLead(
      { leadId: "lead_1" },
      { client: fake.client },
    );

    expect(result).toEqual({ status: "deleted", leadId: "lead_1" });
    expect(fake.state.leads.map((lead) => lead.id)).toEqual(["lead_2"]);
  });

  it("throws when the lead does not exist", async () => {
    const fake = buildClient({ leads: [makeLead({ id: "lead_1" })] });

    await expect(
      adminDeleteLead({ leadId: "missing" }, { client: fake.client }),
    ).rejects.toBeInstanceOf(LeadAdminServiceError);
    expect(fake.state.leads).toHaveLength(1);
  });
});
