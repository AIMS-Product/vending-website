import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminRunQualificationLifecycle } from "./qualification-lifecycle";
import type { Database, Tables } from "@/types/database";

type QualificationSessionRow = Tables<"qualification_sessions">;
type CloseSyncEventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;
type QualificationLifecycleClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  sessions: QualificationSessionRow[];
  events: CloseSyncEventRow[];
  leads: LeadRow[];
};

const nowIso = "2026-06-25T09:00:00.000Z";

function makeSession(
  overrides: Partial<QualificationSessionRow> = {},
): QualificationSessionRow {
  return {
    id: "session_1",
    lead_submission_id: "lead_1",
    form_id: "form_1",
    form_version_id: "version_1",
    session_token_hash: "sha256:session_1",
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
    answer_count: 1,
    normalized_summary: {},
    consent_accepted_at: null,
    consent_question_snapshot: null,
    consent_user_agent: null,
    consent_source_attribution: {},
    stale_at: "2026-06-24T09:00:00.000Z",
    expires_at: "2026-07-17T09:00:00.000Z",
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

function makeEvent(
  overrides: Partial<CloseSyncEventRow> = {},
): CloseSyncEventRow {
  return {
    id: "event_1",
    lead_submission_id: "lead_1",
    session_id: "session_1",
    event_type: "stale_follow_up_task",
    status: "pending",
    dedupe_key: "stale_follow_up_task:session_1",
    payload: {},
    close_lead_id: "close_lead_1",
    close_contact_id: "close_contact_1",
    attempt_count: 0,
    max_attempts: 8,
    next_retry_at: nowIso,
    last_attempted_at: null,
    synced_at: null,
    last_error: null,
    created_at: nowIso,
    updated_at: nowIso,
    ...overrides,
  };
}

function buildClient(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    sessions: [makeSession()],
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
    } as unknown as QualificationLifecycleClient,
  };
}

class FakeQuery {
  private filters: Array<{
    op: "eq" | "in" | "lte";
    key: string;
    value: unknown;
  }> = [];
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
    this.filters.push({ op: "eq", key, value });
    return this;
  }

  in(key: string, value: unknown[]) {
    this.filters.push({ op: "in", key, value });
    return this;
  }

  lte(key: string, value: unknown) {
    this.filters.push({ op: "lte", key, value });
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

  insert(value: Record<string, unknown>) {
    if (this.table !== "close_sync_events") {
      throw new Error(`Unexpected insert into ${this.table}`);
    }
    if (
      value.dedupe_key &&
      this.state.events.some((event) => event.dedupe_key === value.dedupe_key)
    ) {
      return {
        select: () => ({
          single: async () => ({
            data: null,
            error: { message: "duplicate key value" },
          }),
        }),
      };
    }

    const row = {
      id: `event_${this.state.events.length + 1}`,
      attempt_count: 0,
      close_contact_id: null,
      close_lead_id: null,
      created_at: nowIso,
      dedupe_key: null,
      last_attempted_at: null,
      last_error: null,
      max_attempts: 8,
      next_retry_at: nowIso,
      payload: {},
      synced_at: null,
      updated_at: nowIso,
      ...(value as Partial<CloseSyncEventRow>),
    } as CloseSyncEventRow;
    this.state.events.push(row);
    return {
      select: () => ({
        single: async () => ({ data: row, error: null }),
      }),
    };
  }

  update(patch: Record<string, unknown>) {
    const apply = async () => {
      if (this.table === "qualification_sessions") {
        this.state.sessions = this.state.sessions.map((row) =>
          this.matches(row)
            ? ({ ...row, ...patch } as QualificationSessionRow)
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
    let rows: Array<QualificationSessionRow | CloseSyncEventRow | LeadRow>;

    if (this.table === "qualification_sessions") {
      rows = [...this.state.sessions];
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
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows;
  }

  private matches(row: object) {
    return this.filters.every(({ op, key, value }) => {
      const actual = (row as Record<string, unknown>)[key];
      if (op === "eq") return actual === value;
      if (op === "in") return (value as unknown[]).includes(actual);
      if (op === "lte") return String(actual ?? "") <= String(value ?? "");
      return true;
    });
  }
}

describe("qualification lifecycle runner", () => {
  it("marks stale sessions and enqueues one stale follow-up task event", async () => {
    const fake = buildClient();

    const result = await adminRunQualificationLifecycle({
      client: fake.client,
      now: () => new Date(nowIso),
    });

    expect(result).toMatchObject({
      scanned: 1,
      markedStale: 1,
      markedExpired: 0,
      taskEventsCreated: 1,
      taskEventsSkipped: 0,
      skipped: 0,
      errors: [],
    });
    expect(fake.state.sessions[0]).toMatchObject({
      status: "stale",
    });
    expect(fake.state.leads[0]).toMatchObject({
      lifecycle_status: "qualification_stale",
      close_sync_status: "pending",
      close_sync_next_retry_at: nowIso,
    });
    expect(fake.state.events).toHaveLength(1);
    expect(fake.state.events[0]).toMatchObject({
      event_type: "stale_follow_up_task",
      status: "pending",
      lead_submission_id: "lead_1",
      session_id: "session_1",
      close_lead_id: "close_lead_1",
      close_contact_id: "close_contact_1",
      dedupe_key: "stale_follow_up_task:session_1",
      next_retry_at: nowIso,
      payload: expect.objectContaining({
        source: "qualification_lifecycle",
        task: {
          text: "Follow up with Jane Buyer about their incomplete qualification.",
          date: "2026-06-25",
        },
        qualification: expect.objectContaining({
          status: "qualification_stale",
          sessionId: "session_1",
          formId: "form_1",
          formVersionId: "version_1",
        }),
        attribution: expect.objectContaining({
          source_path: "/start",
          source_block_id: "lead-block",
          experiment_key: "post_submit_qualification",
          variant_key: "v1",
        }),
      }),
    });
  });

  it("marks expired incomplete sessions without creating stale task events", async () => {
    const fake = buildClient({
      sessions: [
        makeSession({
          id: "session_expired",
          expires_at: "2026-06-24T09:00:00.000Z",
        }),
      ],
    });

    const result = await adminRunQualificationLifecycle({
      client: fake.client,
      now: () => new Date(nowIso),
    });

    expect(result).toMatchObject({
      scanned: 1,
      markedStale: 0,
      markedExpired: 1,
      taskEventsCreated: 0,
    });
    expect(fake.state.sessions[0]).toMatchObject({
      status: "expired",
      current_question_id: null,
    });
    expect(fake.state.leads[0]).toMatchObject({
      lifecycle_status: "qualification_expired",
    });
    expect(fake.state.events).toHaveLength(0);
  });

  it("preserves completed sessions and already-qualified leads", async () => {
    const fake = buildClient({
      sessions: [
        makeSession({
          id: "session_completed",
          status: "completed",
          completed_at: "2026-06-18T09:00:00.000Z",
          stale_at: "2026-06-19T09:00:00.000Z",
          expires_at: "2026-06-20T09:00:00.000Z",
        }),
        makeSession({
          id: "session_old_incomplete",
          status: "in_progress",
          lead_submission_id: "lead_qualified",
          stale_at: "2026-06-19T09:00:00.000Z",
        }),
      ],
      leads: [
        makeLead({
          id: "lead_1",
          lifecycle_status: "qualified",
          latest_qualification_completed_at: "2026-06-18T09:00:00.000Z",
        }),
        makeLead({
          id: "lead_qualified",
          lifecycle_status: "qualified",
          latest_qualification_session_id: "session_completed",
          latest_qualification_completed_at: "2026-06-18T09:00:00.000Z",
        }),
      ],
    });

    const result = await adminRunQualificationLifecycle({
      client: fake.client,
      now: () => new Date(nowIso),
    });

    expect(result.markedExpired).toBe(0);
    expect(result.markedStale).toBe(1);
    expect(result.taskEventsCreated).toBe(0);
    expect(fake.state.sessions[0]).toMatchObject({
      status: "completed",
      completed_at: "2026-06-18T09:00:00.000Z",
    });
    expect(fake.state.leads).toEqual([
      expect.objectContaining({
        id: "lead_1",
        lifecycle_status: "qualified",
      }),
      expect.objectContaining({
        id: "lead_qualified",
        lifecycle_status: "qualified",
      }),
    ]);
  });

  it("does not create duplicate stale task events when re-run", async () => {
    const fake = buildClient({
      events: [makeEvent()],
    });

    const first = await adminRunQualificationLifecycle({
      client: fake.client,
      now: () => new Date(nowIso),
    });
    const second = await adminRunQualificationLifecycle({
      client: fake.client,
      now: () => new Date(nowIso),
    });

    expect(first).toMatchObject({
      markedStale: 1,
      taskEventsCreated: 0,
      taskEventsSkipped: 1,
    });
    expect(second).toMatchObject({
      scanned: 1,
      markedStale: 0,
      taskEventsCreated: 0,
      taskEventsSkipped: 1,
    });
    expect(fake.state.events).toHaveLength(1);
  });
});
