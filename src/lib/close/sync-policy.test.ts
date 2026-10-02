import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeConfigFromEnv } from "./client";
import { adminRunCloseSync } from "./sync";
import type { Database, Tables } from "@/types/database";

/**
 * Queue policy for the Close sync drain, characterized: the retry schedule,
 * the dead-letter boundary, which statuses are ever listed again, parking for
 * review, and phone normalization on the wire. sync.test.ts covers the happy
 * paths and the integration cases; this file pins the numbers and the rules a
 * change would otherwise move without anyone noticing. Close is customer
 * visible the moment this deploys, so these are the values worth freezing.
 */

type EventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;
type SyncClient = Pick<SupabaseClient<Database>, "from">;

type State = { events: EventRow[]; leads: LeadRow[] };

const T0 = new Date("2026-06-17T09:00:00.000Z");
const minutesAfter = (base: Date, minutes: number) =>
  new Date(base.getTime() + minutes * 60_000);

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_local_1",
    idempotency_key: "lead-key",
    form_type: "contact",
    status: "received",
    full_name: "Jane Buyer",
    email: "buyer@example.com",
    phone: "415-555-0101",
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
    newsletter_subscribed_at: null,
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
    call_booked_at: null,
    booked_by_setter: null,
    entry_resource_tag: null,
    close_lead_created_at: null,
    call_outcome: null,
    close_status_at: null,
    closed_won_at: null,
    closed_won_source: null,
    closed_won_value: null,
    call_status: null,
    call_reconciled_at: null,
    close_sync_last_error: null,
    created_at: "2026-06-17T09:00:00.000Z",
    updated_at: "2026-06-17T09:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "event_1",
    lead_submission_id: "lead_local_1",
    session_id: "session_1",
    event_type: "lead_create_or_update",
    status: "pending",
    dedupe_key: "k",
    payload: {
      contact: {
        full_name: "Jane Buyer",
        email: "buyer@example.com",
        phone: "415-555-0101",
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

/** In-memory close_sync_events / lead_submissions; any other table reads empty. */
function buildClient(initial: Partial<State> = {}) {
  const state: State = {
    events: [makeEvent()],
    leads: [makeLead()],
    ...initial,
  };

  class Query {
    private filters: Array<{ key: string; value: unknown; op: string }> = [];
    private orderKey: string | null = null;
    private orderAscending = true;
    private limitCount: number | null = null;
    private patch: Record<string, unknown> | null = null;
    constructor(private table: string) {}
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
    in(key: string, value: readonly unknown[]) {
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
    update(patch: Record<string, unknown>) {
      this.patch = patch;
      return this;
    }
    async single() {
      const row = this.rows()[0] ?? null;
      return { data: row, error: row ? null : { message: "Not found" } };
    }
    async maybeSingle() {
      return { data: this.rows()[0] ?? null, error: null };
    }
    then(resolve: (value: { data: unknown; error: null }) => void) {
      if (this.patch) {
        const patch = this.patch;
        this.patch = null;
        const affected: unknown[] = [];
        if (this.table === "close_sync_events") {
          state.events = state.events.map((row) => {
            if (!this.matches(row)) return row;
            const next = { ...row, ...patch } as EventRow;
            affected.push(next);
            return next;
          });
        } else if (this.table === "lead_submissions") {
          state.leads = state.leads.map((row) => {
            if (!this.matches(row)) return row;
            const next = { ...row, ...patch } as LeadRow;
            affected.push(next);
            return next;
          });
        }
        return resolve({ data: affected, error: null });
      }
      return resolve({ data: this.rows(), error: null });
    }
    private rows(): Array<Record<string, unknown>> {
      let rows: Array<Record<string, unknown>> =
        this.table === "close_sync_events"
          ? [...state.events]
          : this.table === "lead_submissions"
            ? [...state.leads]
            : [];
      rows = rows.filter((row) => this.matches(row));
      if (this.orderKey) {
        const key = this.orderKey;
        rows.sort((a, b) => {
          const compared = String(a[key] ?? "").localeCompare(
            String(b[key] ?? ""),
          );
          return this.orderAscending ? compared : -compared;
        });
      }
      return this.limitCount == null ? rows : rows.slice(0, this.limitCount);
    }
    private matches(row: object) {
      return this.filters.every(({ key, value, op }) => {
        const actual = (row as Record<string, unknown>)[key];
        if (op === "lte") return String(actual ?? "") <= String(value ?? "");
        if (op === "in") return (value as unknown[]).includes(actual);
        return actual === value;
      });
    }
  }

  // Tables this fake does not hold (chatbot reads after a sync) answer through
  // a chain that tolerates any method and resolves empty.
  const tolerant = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void) =>
            resolve({ data: [], error: null });
        }
        if (property === "single" || property === "maybeSingle") {
          return async () => ({ data: null, error: null });
        }
        return tolerant;
      },
      apply: () => tolerant(),
    });

  return {
    state,
    client: {
      from(table: string) {
        return table === "close_sync_events" || table === "lead_submissions"
          ? new Query(table)
          : tolerant();
      },
    } as unknown as SyncClient,
  };
}

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const config = closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" });

function drain(
  fake: ReturnType<typeof buildClient>,
  fetchMock: ReturnType<typeof vi.fn>,
  now: Date,
  maxEvents?: number,
) {
  return adminRunCloseSync({
    client: fake.client,
    closeConfig: config,
    fetchImpl: fetchMock as unknown as typeof fetch,
    now: () => now,
    maxEvents,
  });
}

/** A stale-follow-up event: one POST to Close, so a 503 fails it cleanly. */
const followUp = (overrides: Partial<EventRow> = {}) =>
  makeEvent({
    event_type: "stale_follow_up_task",
    close_lead_id: "lead_close_1",
    close_contact_id: "cont_close_1",
    payload: { task: { text: "Follow up", date: "2026-06-24" } },
    ...overrides,
  });

describe("retry schedule", () => {
  // [attempts already made, max attempts, minutes until the next try, outcome]
  it.each([
    [0, 8, 5, "failed"],
    [1, 8, 10, "failed"],
    [2, 8, 20, "failed"],
    [3, 8, 40, "failed"],
    [4, 8, 80, "failed"],
    [5, 8, 160, "failed"],
    [6, 8, 320, "failed"],
    // The last attempt: dead-lettered, and the backoff is still computed.
    [7, 8, 640, "dead_letter"],
    [8, 20, 1280, "failed"],
    // Capped at 24 hours from the tenth attempt on.
    [9, 20, 1440, "failed"],
    [14, 20, 1440, "failed"],
  ])(
    "after %i prior attempts (max %i) waits %i minutes and ends %s",
    async (prior, max, minutes, outcome) => {
      const fake = buildClient({
        events: [followUp({ attempt_count: prior, max_attempts: max })],
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("upstream down", { status: 503 }));

      const result = await drain(fake, fetchMock, T0);

      expect(fake.state.events[0].status).toBe(outcome);
      expect(fake.state.events[0].attempt_count).toBe(prior + 1);
      expect(fake.state.events[0].next_retry_at).toBe(
        minutesAfter(T0, minutes).toISOString(),
      );
      expect(fake.state.events[0].last_attempted_at).toBe(T0.toISOString());
      expect(result.failed + result.deadLettered).toBe(1);
      // The lead row mirrors the same schedule for the admin list.
      expect(fake.state.leads[0]).toMatchObject({
        close_sync_status: outcome,
        close_sync_attempt_count: prior + 1,
        close_sync_next_retry_at: minutesAfter(T0, minutes).toISOString(),
      });
    },
  );
});

describe("what the drain lists", () => {
  it("lists a failed event again only once its backoff has passed", async () => {
    const fake = buildClient({ events: [followUp()] });
    const down = vi.fn().mockResolvedValue(new Response("x", { status: 503 }));

    await drain(fake, down, T0);
    // Next try is due at T0 + 5 minutes.
    const early = await drain(fake, down, minutesAfter(T0, 4));
    expect(early.scanned).toBe(0);
    expect(fake.state.events[0].attempt_count).toBe(1);

    const due = await drain(fake, down, minutesAfter(T0, 5));
    expect(due.scanned).toBe(1);
    expect(fake.state.events[0].attempt_count).toBe(2);
    expect(fake.state.events[0].next_retry_at).toBe(
      minutesAfter(T0, 5 + 10).toISOString(),
    );
  });

  it("succeeds on a later attempt and then never lists the event again", async () => {
    const fake = buildClient({ events: [followUp()] });
    const down = vi.fn().mockResolvedValue(new Response("x", { status: 503 }));
    await drain(fake, down, T0);

    const up = vi.fn().mockResolvedValue(jsonResponse({ id: "task_1" }));
    const second = await drain(fake, up, minutesAfter(T0, 5));
    const third = await drain(fake, up, minutesAfter(T0, 600));

    expect(second.synced).toBe(1);
    expect(fake.state.events[0]).toMatchObject({
      status: "synced",
      attempt_count: 2,
      last_error: null,
    });
    expect(third.scanned).toBe(0);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it.each(["synced", "dead_letter", "needs_review"])(
    "never lists an event in status %s, however overdue",
    async (status) => {
      const fake = buildClient({
        events: [
          followUp({ status, next_retry_at: "2020-01-01T00:00:00.000Z" }),
        ],
      });
      const fetchMock = vi.fn();

      const result = await drain(fake, fetchMock, T0);

      expect(result.scanned).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("lists pending, failed and retrying events, oldest due first", async () => {
    const fake = buildClient({
      events: [
        followUp({
          id: "c",
          status: "retrying",
          next_retry_at: "2026-06-17T08:30:00.000Z",
        }),
        followUp({
          id: "a",
          status: "pending",
          next_retry_at: "2026-06-17T08:00:00.000Z",
        }),
        followUp({
          id: "b",
          status: "failed",
          next_retry_at: "2026-06-17T08:15:00.000Z",
        }),
      ],
    });
    const order: string[] = [];
    const fetchMock = vi.fn().mockImplementation(async () => {
      order.push(
        fake.state.events.find(
          (e) => e.status === "retrying" && e.last_attempted_at,
        )?.id ?? "?",
      );
      return jsonResponse({ id: "task" });
    });

    const result = await drain(fake, fetchMock, T0);

    expect(result).toMatchObject({ scanned: 3, synced: 3 });
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("honours maxEvents", async () => {
    const fake = buildClient({
      events: [
        followUp({ id: "a" }),
        followUp({ id: "b" }),
        followUp({ id: "c" }),
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "task" }));

    const result = await drain(fake, fetchMock, T0, 2);

    expect(result.scanned).toBe(2);
  });
});

describe("parking for review", () => {
  it("parks an event that can never succeed, on the first attempt, without calling Close", async () => {
    const fake = buildClient({
      events: [followUp({ close_lead_id: null, close_contact_id: null })],
      leads: [makeLead({ close_lead_id: null })],
    });
    const fetchMock = vi.fn();

    const result = await drain(fake, fetchMock, T0);

    expect(result).toMatchObject({
      needsReview: 1,
      failed: 0,
      deadLettered: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.state.events[0]).toMatchObject({
      status: "needs_review",
      attempt_count: 1,
      last_error: "Stale follow-up task is missing a Close lead ID.",
    });
    expect(result.errors).toEqual([
      {
        eventId: "event_1",
        message: "Stale follow-up task is missing a Close lead ID.",
      },
    ]);
    // The lead's own sync state says needs_review too, so it shows in the admin list.
    expect(fake.state.leads[0]).toMatchObject({
      close_sync_status: "needs_review",
      close_sync_attempt_count: 1,
    });
  });

  it("leaves a parked event parked: later drains never touch it, however long they wait", async () => {
    const fake = buildClient({
      events: [followUp({ close_lead_id: null, close_contact_id: null })],
      leads: [makeLead({ close_lead_id: null })],
    });
    await drain(fake, vi.fn(), T0);

    const later = await drain(fake, vi.fn(), minutesAfter(T0, 60 * 24 * 30));

    expect(later.scanned).toBe(0);
    expect(fake.state.events[0].status).toBe("needs_review");
    expect(fake.state.events[0].attempt_count).toBe(1);
  });

  it("does not park a transient Close failure: 5xx and 4xx both retry until dead letter", async () => {
    for (const status of [400, 404, 500, 503]) {
      const fake = buildClient({ events: [followUp()] });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("nope", { status }));

      const result = await drain(fake, fetchMock, T0);

      expect(result, String(status)).toMatchObject({
        failed: 1,
        needsReview: 0,
      });
      expect(fake.state.events[0].status, String(status)).toBe("failed");
    }
  });

  it("sanitizes and bounds the stored error, never storing the API key", async () => {
    const fake = buildClient({ events: [followUp()] });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(`bad key close_key_123 ${"x".repeat(2000)}`, {
        status: 500,
      }),
    );

    await drain(fake, fetchMock, T0);

    const stored = fake.state.events[0].last_error ?? "";
    expect(stored).not.toContain("close_key_123");
    expect(stored.length).toBeLessThanOrEqual(320);
    expect(fake.state.leads[0].close_sync_last_error).toBe(stored);
  });
});

describe("outbox events that are not the lead's Close sync", () => {
  it.each(["warm_reply_activity", "ghl_forward", "kit_subscribe"])(
    "a failing %s never overwrites the lead's own sync state",
    async (eventType) => {
      const fake = buildClient({
        events: [
          makeEvent({
            event_type: eventType,
            payload: {},
            close_lead_id: "lead_close_1",
            max_attempts: 1,
          }),
        ],
        leads: [
          makeLead({
            close_sync_status: "synced",
            close_sync_attempt_count: 1,
            close_sync_last_error: null,
          }),
        ],
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("x", { status: 503 }));

      await drain(fake, fetchMock, T0);

      expect(fake.state.leads[0]).toMatchObject({
        close_sync_status: "synced",
        close_sync_attempt_count: 1,
        close_sync_last_error: null,
      });
      expect(fake.state.events[0].status).not.toBe("pending");
    },
  );
});

describe("phone normalization on the wire", () => {
  async function createdContact(phone: string | null, payloadPhone?: string) {
    const fake = buildClient({
      events: [
        makeEvent({
          payload: {
            contact: {
              full_name: "Jane Buyer",
              email: "buyer@example.com",
              ...(payloadPhone === undefined ? {} : { phone: payloadPhone }),
            },
          },
        }),
      ],
      leads: [makeLead({ phone })],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "lead_created",
          contacts: [{ id: "cont_created" }],
        }),
      );

    const result = await drain(fake, fetchMock, T0);
    const creates = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith("/lead/") && init?.method === "POST",
    );
    return {
      result,
      creates,
      contact: JSON.parse(creates[0]?.[1]?.body as string).contacts[0] as {
        phones?: Array<{ phone: string; type: string }>;
      },
    };
  }

  it.each([
    ["415-555-0101", "+14155550101"],
    ["(415) 555-0101", "+14155550101"],
    ["+1 415 555 0101", "+14155550101"],
    ["+44 7911 123456", "+447911123456"],
    ["0032 470 12 34 56", "+32470123456"],
  ])("sends %s to Close as %s", async (typed, e164) => {
    const { contact, result } = await createdContact(typed);

    expect(contact.phones).toEqual([{ phone: e164, type: "direct" }]);
    expect(result.synced).toBe(1);
  });

  // Shapes seen in production Aug-Sep 2026 (values synthetic): each made Close
  // 400 the whole lead write.
  it.each(["0907 555 0100", "07496 123456", "someone@example.com", "1", "   "])(
    "drops the unusable phone %j and still creates the lead in a single call",
    async (typed) => {
      const { contact, creates, result } = await createdContact(typed);

      expect(contact).not.toHaveProperty("phones");
      expect(contact).toHaveProperty("emails");
      expect(creates).toHaveLength(1);
      expect(result.synced).toBe(1);
    },
  );

  it("sends no phones at all for a lead with no phone", async () => {
    const { contact } = await createdContact(null);

    expect(contact).not.toHaveProperty("phones");
  });

  it("prefers the phone frozen in the event payload over the lead row's current one", async () => {
    const { contact } = await createdContact("999-999-9999", "415-555-0101");

    expect(contact.phones).toEqual([{ phone: "+14155550101", type: "direct" }]);
  });
});

describe("qualification enrichment retried after a partial write", () => {
  const enrichment = () =>
    makeEvent({
      event_type: "qualification_enrichment",
      lead_submission_id: null,
      close_lead_id: "lead_close_1",
      close_contact_id: "cont_close_1",
      payload: {
        qualification: { status: "qualified", score: 82, band: "top_closers" },
        normalized: {},
        answers: [{ label: "Capital", value: "$25k" }],
      },
    });

  const enrichConfig = closeConfigFromEnv({
    CLOSE_API_KEY: "close_key_123",
    CLOSE_QUALIFICATION_STATUS_FIELD_ID: "cf_status",
  });

  // The note is POSTed first and Close's note endpoint has no idempotency key.
  // If the lead-field PUT that follows hits a 5xx, the event is retried and the
  // retry POSTs the note again, so one qualified lead ends up with two identical
  // "Qualification completed" notes on the Close record. Other note writers
  // (chatbot close-note, pre-call-note) look for their own marker first; this
  // path does not. Left as-is: src/lib/close is off limits for behaviour
  // changes in this pass.
  it.fails(
    "posts the qualification note once even when the write after it fails and is retried",
    async () => {
      const fake = buildClient({ events: [enrichment()], leads: [] });
      const notePosts: unknown[] = [];
      let leadPuts = 0;
      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: unknown, init?: RequestInit) => {
          const target = String(url);
          if (target.endsWith("/activity/note/") && init?.method === "POST") {
            notePosts.push(init.body);
            return jsonResponse({ id: `note_${notePosts.length}` });
          }
          if (target.endsWith("/lead/lead_close_1/")) {
            leadPuts += 1;
            // First attempt: Close is down for the lead update. Second: fine.
            return leadPuts === 1
              ? new Response("down", { status: 503 })
              : jsonResponse({ id: "lead_close_1" });
          }
          return jsonResponse({ data: [] });
        });

      const run = (now: Date) =>
        adminRunCloseSync({
          client: fake.client,
          closeConfig: enrichConfig,
          fetchImpl: fetchMock as unknown as typeof fetch,
          now: () => now,
        });
      await run(T0);
      await run(minutesAfter(T0, 5));

      expect(fake.state.events[0].status).toBe("synced");
      expect(notePosts).toHaveLength(1);
    },
  );

  it("documents today's behaviour for that retry: the note is posted on every attempt", async () => {
    const fake = buildClient({ events: [enrichment()], leads: [] });
    let leadPuts = 0;
    let notePosts = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: unknown, init?: RequestInit) => {
        const target = String(url);
        if (target.endsWith("/activity/note/") && init?.method === "POST") {
          notePosts += 1;
          return jsonResponse({ id: `note_${notePosts}` });
        }
        if (target.endsWith("/lead/lead_close_1/")) {
          leadPuts += 1;
          return leadPuts === 1
            ? new Response("down", { status: 503 })
            : jsonResponse({ id: "lead_close_1" });
        }
        return jsonResponse({ data: [] });
      });

    const run = (now: Date) =>
      adminRunCloseSync({
        client: fake.client,
        closeConfig: enrichConfig,
        fetchImpl: fetchMock as unknown as typeof fetch,
        now: () => now,
      });
    await run(T0);
    await run(minutesAfter(T0, 5));

    expect(notePosts).toBe(2);
  });
});
