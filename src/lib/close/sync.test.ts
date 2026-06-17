import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CloseApiError, closeConfigFromEnv, createCloseClient } from "./client";
import { adminRunCloseSync } from "./sync";
import type { Database, Json, Tables } from "@/types/database";

type CloseSyncEventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;
type CloseSyncClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  events: CloseSyncEventRow[];
  leads: LeadRow[];
  updates: Array<{
    table: "close_sync_events" | "lead_submissions";
    id: string;
    patch: Record<string, unknown>;
  }>;
};

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_local_1",
    idempotency_key: "lead-key",
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
    close_lead_id: null,
    close_contact_id: null,
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
    lead_submission_id: "lead_local_1",
    session_id: "session_1",
    event_type: "lead_create_or_update",
    status: "pending",
    dedupe_key: "lead_create_or_update:lead_local_1:session_1",
    payload: {
      contact: {
        full_name: "Jane Buyer",
        email: "buyer@example.com",
        phone: "555-0101",
      },
      qualification: {
        status: "qualification_pending",
        sessionId: "session_1",
      },
    },
    close_lead_id: null,
    close_contact_id: null,
    attempt_count: 0,
    max_attempts: 8,
    next_retry_at: "2026-06-17T09:00:00.000Z",
    last_attempted_at: null,
    synced_at: null,
    last_error: null,
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:00:00.000Z",
    ...overrides,
  };
}

function buildClient(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    events: [makeEvent()],
    leads: [makeLead()],
    updates: [],
    ...initial,
  };

  return {
    state,
    client: {
      from(table: string) {
        return new FakeQuery(table, state);
      },
    } as unknown as CloseSyncClient,
  };
}

class FakeQuery {
  private filters: Array<{
    key: string;
    value: unknown;
    op: "eq" | "lte";
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
    this.filters.push({ key, value, op: "eq" });
    return this;
  }

  lte(key: string, value: unknown) {
    this.filters.push({ key, value, op: "lte" });
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

  async single() {
    const row = this.rows()[0] ?? null;
    return { data: row, error: row ? null : { message: "Not found" } };
  }

  update(patch: Record<string, unknown>) {
    const apply = async () => {
      if (this.table === "close_sync_events") {
        this.state.events = this.state.events.map((row) => {
          if (!this.matches(row)) return row;
          this.state.updates.push({
            table: "close_sync_events",
            id: row.id,
            patch,
          });
          return { ...row, ...patch } as CloseSyncEventRow;
        });
      } else if (this.table === "lead_submissions") {
        this.state.leads = this.state.leads.map((row) => {
          if (!this.matches(row)) return row;
          this.state.updates.push({
            table: "lead_submissions",
            id: row.id,
            patch,
          });
          return { ...row, ...patch } as LeadRow;
        });
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
    let rows: Array<CloseSyncEventRow | LeadRow> =
      this.table === "close_sync_events"
        ? [...this.state.events]
        : [...this.state.leads];

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
    return this.filters.every(({ key, value, op }) => {
      const actual = (row as Record<string, unknown>)[key];
      if (op === "lte") return String(actual ?? "") <= String(value ?? "");
      return actual === value;
    });
  }
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Close API client", () => {
  it("uses API-key Basic auth and JSON requests without exposing the key in errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "lead_close_1" }))
      .mockResolvedValueOnce(
        new Response("provider failed with close_key_123", { status: 502 }),
      );
    const client = createCloseClient({
      apiKey: "close_key_123",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await client.createLead({
      name: "Jane Buyer",
      contacts: [
        { name: "Jane Buyer", emails: [{ email: "buyer@example.com" }] },
      ],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.close.com/api/v1/lead/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("close_key_123:").toString("base64")}`,
          "Content-Type": "application/json",
        }),
      }),
    );

    let error: unknown;
    try {
      await client.createTask({
        _type: "lead",
        lead_id: "lead_close_1",
        text: "Follow up",
        date: "2026-06-18",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CloseApiError);
    expect(error).toMatchObject({
      message: expect.not.stringContaining("close_key_123"),
    });
  });

  it("treats missing API key as disabled config", () => {
    expect(closeConfigFromEnv({ CLOSE_API_KEY: "" })).toMatchObject({
      enabled: false,
      apiKey: undefined,
    });
  });
});

describe("adminRunCloseSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records retryable failure without calling Close when config is missing", async () => {
    const fake = buildClient();
    const fetchMock = vi.fn();

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(result).toMatchObject({ scanned: 1, synced: 0, failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.state.events[0]).toMatchObject({
      status: "failed",
      attempt_count: 1,
      last_attempted_at: "2026-06-17T09:00:00.000Z",
      next_retry_at: "2026-06-17T09:05:00.000Z",
      last_error: "Close API key is not configured.",
    });
    expect(fake.state.leads[0]).toMatchObject({
      close_sync_status: "failed",
      close_sync_attempt_count: 1,
      close_sync_last_error: "Close API key is not configured.",
    });
    expect(fake.state.updates).toContainEqual({
      table: "close_sync_events",
      id: "event_1",
      patch: expect.objectContaining({ status: "retrying" }),
    });
  });

  it("uses existing Close IDs before searching and marks the event synced", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
        }),
      ],
      leads: [
        makeLead({
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_1" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(result).toMatchObject({ scanned: 1, synced: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.close.com/api/v1/contact/cont_close_1/",
    );
    expect(fake.state.events[0]).toMatchObject({
      status: "synced",
      close_lead_id: "lead_close_1",
      close_contact_id: "cont_close_1",
      synced_at: "2026-06-17T09:00:00.000Z",
    });
    expect(fake.state.leads[0]).toMatchObject({
      close_sync_status: "synced",
      close_contact_id: "cont_close_1",
      close_lead_id: "lead_close_1",
    });
  });

  it("reuses one clear Close contact match and flags ambiguous matches for review", async () => {
    const single = buildClient();
    const singleFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "cont_close_2",
              lead_id: "lead_close_2",
              emails: [{ email: "buyer@example.com" }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_2" }));

    const singleResult = await adminRunCloseSync({
      client: single.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: singleFetch as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(singleResult).toMatchObject({ synced: 1 });
    expect(single.state.events[0]).toMatchObject({
      status: "synced",
      close_lead_id: "lead_close_2",
      close_contact_id: "cont_close_2",
    });
    expect(singleFetch.mock.calls[0]?.[0]).toContain(
      "/contact/?email=buyer%40example.com",
    );

    const ambiguous = buildClient({
      events: [makeEvent({ id: "event_ambiguous" })],
    });
    const ambiguousFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: "cont_a", lead_id: "lead_a" },
          { id: "cont_b", lead_id: "lead_b" },
        ],
      }),
    );

    const ambiguousResult = await adminRunCloseSync({
      client: ambiguous.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: ambiguousFetch as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(ambiguousResult).toMatchObject({ needsReview: 1, synced: 0 });
    expect(ambiguous.state.events[0]).toMatchObject({
      status: "needs_review",
      last_error: "Multiple Close contacts matched buyer@example.com.",
    });
    expect(ambiguousFetch).toHaveBeenCalledTimes(1);
  });

  it("creates a Close lead/contact when no existing match is found", async () => {
    const fake = buildClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "lead_created",
          contact_ids: ["cont_created"],
          contacts: [{ id: "cont_created" }],
        }),
      );

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.close.com/api/v1/lead/",
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        name: "Jane Buyer",
        contacts: [
          expect.objectContaining({
            name: "Jane Buyer",
            emails: [{ email: "buyer@example.com", type: "office" }],
            phones: [{ phone: "555-0101", type: "mobile" }],
          }),
        ],
      }),
    );
    expect(fake.state.events[0]).toMatchObject({
      status: "synced",
      close_lead_id: "lead_created",
      close_contact_id: "cont_created",
    });
  });

  it("writes qualification notes and configured custom fields on enrichment events", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          event_type: "qualification_enrichment",
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
          payload: {
            qualification: {
              status: "qualified",
              sessionId: "session_1",
              completedAt: "2026-06-17T09:30:00.000Z",
            },
            normalized: {
              state_market: "SA",
              available_capital: "$25k-$50k",
            },
            answers: [
              { label: "State", value: "SA" },
              { label: "Available capital", value: "$25k-$50k" },
            ],
          },
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "acti_note_1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "lead_close_1" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_QUALIFICATION_STATUS_FIELD_ID: "cf_status",
        CLOSE_STATE_MARKET_FIELD_ID: "cf_state",
        CLOSE_AVAILABLE_CAPITAL_FIELD_ID: "cf_capital",
      }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T10:00:00.000Z"),
    });

    expect(result).toMatchObject({ synced: 1 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.close.com/api/v1/activity/note/",
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        lead_id: "lead_close_1",
        note_html: expect.stringContaining("Available capital"),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      "custom.cf_status": "qualified",
      "custom.cf_state": "SA",
      "custom.cf_capital": "$25k-$50k",
    });
  });

  it("dead-letters exhausted events with bounded sanitized provider errors", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          attempt_count: 7,
          max_attempts: 8,
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
        }),
      ],
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("upstream exploded close_key_123 ".repeat(40), {
        status: 503,
      }),
    );

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(result).toMatchObject({ deadLettered: 1, failed: 0 });
    expect(fake.state.events[0].status).toBe("dead_letter");
    expect(fake.state.events[0].attempt_count).toBe(8);
    expect(fake.state.events[0].last_error).toContain("503");
    expect(fake.state.events[0].last_error).not.toContain("close_key_123");
    expect(fake.state.events[0].last_error?.length).toBeLessThanOrEqual(320);
  });

  it("creates a stale qualification follow-up task event", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          event_type: "stale_follow_up_task",
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
          payload: {
            task: {
              text: "Incomplete qualification follow-up",
              date: "2026-06-24",
            },
          } satisfies Json,
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "task_1" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.close.com/api/v1/task/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          _type: "lead",
          lead_id: "lead_close_1",
          text: "Incomplete qualification follow-up",
          date: "2026-06-24",
          is_complete: false,
        }),
      }),
    );
    expect(fake.state.events[0].status).toBe("synced");
  });
});
