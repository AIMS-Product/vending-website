import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CloseApiError,
  CLOSE_RESOURCE_TAGS,
  closeConfigFromEnv,
  createCloseClient,
} from "./client";
import { adminRunCloseSync } from "./sync";
import { LEAD_MAGNET_FORM_ID } from "@/lib/content/lead-magnets";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
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
  // When set, any close_sync_events update touching this id resolves with a
  // PostgREST error instead of applying — the way a dropped connection does.
  failEventUpdatesFor?: string;
};

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
    call_status: null,
    call_reconciled_at: null,
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
        phone: "415-555-0101",
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
    op: "eq" | "lte" | "in";
  }> = [];
  private orderKey: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private pendingUpdate: Record<string, unknown> | null = null;

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

  in(key: string, values: readonly unknown[]) {
    this.filters.push({ key, value: values, op: "in" });
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

  // The update stays pending until the query is awaited, so filters added
  // after it (`.eq(...).in(...).select()`) still apply. That mirrors
  // PostgREST, where a conditional update matches zero rows when its filters
  // miss — which is what the sync claim relies on.
  update(patch: Record<string, unknown>) {
    this.pendingUpdate = patch;
    return this;
  }

  private applyUpdate(patch: Record<string, unknown>) {
    const affected: Array<CloseSyncEventRow | LeadRow> = [];

    if (this.table === "close_sync_events") {
      this.state.events = this.state.events.map((row) => {
        if (!this.matches(row)) return row;
        this.state.updates.push({
          table: "close_sync_events",
          id: row.id,
          patch,
        });
        const next = { ...row, ...patch } as CloseSyncEventRow;
        affected.push(next);
        return next;
      });
    } else if (this.table === "lead_submissions") {
      this.state.leads = this.state.leads.map((row) => {
        if (!this.matches(row)) return row;
        this.state.updates.push({
          table: "lead_submissions",
          id: row.id,
          patch,
        });
        const next = { ...row, ...patch } as LeadRow;
        affected.push(next);
        return next;
      });
    } else {
      throw new Error(`Unexpected update to ${this.table}`);
    }

    return affected;
  }

  then(
    resolve: (value: {
      data: unknown[] | null;
      error: { message: string } | null;
    }) => void,
  ) {
    if (this.pendingUpdate) {
      const patch = this.pendingUpdate;
      this.pendingUpdate = null;
      const failFor = this.state.failEventUpdatesFor;
      if (
        this.table === "close_sync_events" &&
        failFor &&
        this.state.events.some((row) => row.id === failFor && this.matches(row))
      ) {
        resolve({ data: null, error: { message: "connection reset" } });
        return;
      }
      resolve({ data: this.applyUpdate(patch), error: null });
      return;
    }
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
      if (op === "in") return (value as unknown[]).includes(actual);
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
    // Close already holds exactly what this submit carries, so the read is the
    // only call: there is nothing to add and nothing may be rewritten.
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        id: "cont_close_1",
        emails: [{ email: "buyer@example.com" }],
        phones: [{ phone: "+14155550101" }],
      }),
    );

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
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
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

  it("updates configured Close source fields on existing Close leads", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
          payload: {
            contact: {
              full_name: "Jane Buyer",
              email: "buyer@example.com",
              phone: "415-555-0101",
            },
            attribution: {
              source_path: "/resources/start-vending",
              utm_source: "google",
              utm_medium: "cpc",
              gclid: "gclid-123",
              campaign_id: "camp-123",
              ad_group_id: "group-123",
              ad_id: "ad-123",
              paid_source_key: "google_ads:camp-123:group-123:ad-123",
            },
          },
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
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cont_close_1",
          emails: [{ email: "buyer@example.com" }],
          phones: [{ phone: "+14155550101" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "lead_close_1" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_UTM_SOURCE_FIELD_ID: "cf_utm_source",
        CLOSE_UTM_MEDIUM_FIELD_ID: "cf_utm_medium",
        CLOSE_GCLID_FIELD_ID: "cf_gclid",
        CLOSE_CAMPAIGN_ID_FIELD_ID: "cf_campaign",
        CLOSE_AD_GROUP_ID_FIELD_ID: "cf_ad_group",
        CLOSE_AD_ID_FIELD_ID: "cf_ad",
        CLOSE_PAID_SOURCE_KEY_FIELD_ID: "cf_paid_source",
      }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(result).toMatchObject({ scanned: 1, synced: 1, failed: 0 });

    // UTMs are contact-scoped in Close, so they ride the contact update and must
    // never appear on the lead — Close 400s a lead update carrying them.
    // calls[0] is the read of the existing contact that keeps the update additive.
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.close.com/api/v1/contact/cont_close_1/",
    );
    const contactBody = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(contactBody["custom.cf_utm_source"]).toBe("google");
    expect(contactBody["custom.cf_utm_medium"]).toBe("cpc");

    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.close.com/api/v1/lead/lead_close_1/",
    );
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      "custom.cf_gclid": "gclid-123",
      "custom.cf_campaign": "camp-123",
      "custom.cf_ad_group": "group-123",
      "custom.cf_ad": "ad-123",
      "custom.cf_paid_source": "google_ads:camp-123:group-123:ad-123",
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
              id: "lead_close_2",
              contacts: [
                {
                  id: "cont_close_2",
                  emails: [{ email: "buyer@example.com" }],
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cont_close_2",
          emails: [{ email: "buyer@example.com" }],
          phones: [{ phone: "+14155550999" }],
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
      `/lead/?query=${encodeURIComponent('email:"buyer@example.com"')}`,
    );

    const ambiguous = buildClient({
      events: [makeEvent({ id: "event_ambiguous" })],
    });
    const ambiguousFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "lead_a",
            contacts: [
              { id: "cont_a", emails: [{ email: "buyer@example.com" }] },
            ],
          },
          {
            id: "lead_b",
            contacts: [
              { id: "cont_b", emails: [{ email: "buyer@example.com" }] },
            ],
          },
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

  it("never rewrites a matched contact's identity from a public submit", async () => {
    // The public form is unauthenticated, so anyone can submit a known
    // customer's email with their own name and phone number. Close's
    // PUT /contact/ replaces arrays wholesale, so the update must add and
    // never substitute, and must not carry `name` at all.
    const fake = buildClient({
      events: [
        makeEvent({
          payload: {
            contact: {
              full_name: "Attacker Name",
              email: "victim@example.com",
              phone: "415-555-9999",
            },
          },
        }),
      ],
      leads: [makeLead({ email: "victim@example.com", phone: "415-555-9999" })],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "lead_victim",
              contacts: [
                {
                  id: "cont_victim",
                  emails: [{ email: "victim@example.com" }],
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cont_victim",
          name: "Real Customer",
          emails: [{ email: "victim@example.com", type: "office" }],
          phones: [{ phone: "+14155550100", type: "office" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "cont_victim" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    const update = JSON.parse(
      fetchMock.mock.calls[2]?.[1]?.body as string,
    ) as Record<string, unknown>;

    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.close.com/api/v1/contact/cont_victim/",
    );
    expect(update).not.toHaveProperty("name");
    // The real number survives and the submitted one is appended after it.
    expect(update.phones).toEqual([
      { phone: "+14155550100", type: "office" },
      { phone: "+14155559999", type: "direct" },
    ]);
    // Nothing new to add, so the key is omitted and Close keeps its array.
    expect(update).not.toHaveProperty("emails");
  });

  it("preserves an unsubscribe flag and never echoes Close's derived fields back", async () => {
    // Shapes taken from a real GET /contact/{id}/ on the production org: Close
    // returns is_unsubscribed on emails and country/phone_formatted on phones.
    // Rebuilding an email entry without is_unsubscribed would resubscribe
    // someone who opted out, as a side effect of a stranger filling in a form.
    const fake = buildClient({
      events: [makeEvent()],
      leads: [makeLead()],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "lead_close_3",
              contacts: [
                {
                  id: "cont_close_3",
                  emails: [{ email: "buyer@example.com" }],
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cont_close_3",
          emails: [
            {
              email: "buyer@example.com",
              type: "office",
              is_unsubscribed: true,
            },
          ],
          phones: [
            {
              phone: "+14155550100",
              type: "office",
              country: "US",
              phone_formatted: "+1 415-555-0100",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_3" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    const update = JSON.parse(
      fetchMock.mock.calls[2]?.[1]?.body as string,
    ) as Record<string, unknown>;

    // The submitted phone differs, so phones are rewritten — and the kept entry
    // must carry only what Close accepts on a write.
    expect(update.phones).toEqual([
      { phone: "+14155550100", type: "office" },
      { phone: "+14155550101", type: "direct" },
    ]);
    // Emails are untouched here, but the same rule applies when they are not.
    expect(update).not.toHaveProperty("emails");
  });

  it("carries is_unsubscribed through when the email array is rewritten", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          payload: {
            contact: {
              full_name: "Jane Buyer",
              email: "new@example.com",
              phone: "415-555-0101",
            },
          },
        }),
      ],
      leads: [makeLead({ email: "new@example.com" })],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "lead_close_4",
              contacts: [
                { id: "cont_close_4", emails: [{ email: "new@example.com" }] },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cont_close_4",
          emails: [
            { email: "old@example.com", type: "office", is_unsubscribed: true },
          ],
          phones: [{ phone: "+14155550101", type: "direct" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_4" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    const update = JSON.parse(
      fetchMock.mock.calls[2]?.[1]?.body as string,
    ) as Record<string, unknown>;

    expect(update.emails).toEqual([
      { email: "old@example.com", type: "office", is_unsubscribed: true },
      { email: "new@example.com", type: "direct" },
    ]);
  });

  it("adds nothing when a matched contact already holds the submitted details", async () => {
    const fake = buildClient({
      events: [makeEvent()],
      leads: [makeLead()],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "lead_close_2",
              contacts: [
                {
                  id: "cont_close_2",
                  emails: [{ email: "buyer@example.com" }],
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cont_close_2",
          // Same address in a different case — matching must be normalized, or
          // the address gets appended a second time.
          emails: [{ email: "Buyer@Example.com" }],
          phones: [{ phone: "+14155550101" }],
        }),
      );

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(result).toMatchObject({ synced: 1 });
    // Search + read only: an empty update is not worth a write.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Production, 2026-08-06: two leads dead-lettered on
  // `{"phones": {"1": {"phone": "Invalid phone number."}}}` and never reached
  // Close at all. The form takes any text up to 60 characters as a phone, and
  // these two people typed an email address and `1` into it. Close rejects what
  // it cannot parse by failing the WHOLE write, so an unusable phone must be
  // dropped before it is sent — the lead matters, the junk phone does not.
  it.each(["tpeek@ryatech.us", "1", "  ", "abcdefghij"])(
    "drops an unusable phone (%s) instead of losing the whole lead",
    async (phone) => {
      const fake = buildClient({
        events: [
          makeEvent({
            payload: {
              contact: {
                full_name: "Jane Buyer",
                email: "buyer@example.com",
                phone,
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

      const result = await adminRunCloseSync({
        client: fake.client,
        closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
        fetchImpl: fetchMock as unknown as typeof fetch,
        now: () => new Date("2026-06-17T09:00:00.000Z"),
      });

      const created = JSON.parse(
        fetchMock.mock.calls[1]?.[1]?.body as string,
      ) as { contacts: Array<Record<string, unknown>> };
      expect(created.contacts[0]).not.toHaveProperty("phones");
      expect(created.contacts[0]).toHaveProperty("emails");
      expect(result).toMatchObject({ synced: 1, deadLettered: 0, failed: 0 });
    },
  );

  it("creates a Close lead/contact when no existing match is found", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          payload: {
            contact: {
              full_name: "Jane Buyer",
              email: "buyer@example.com",
              phone: "415-555-0101",
            },
            attribution: {
              vp_session_id: "vp-session-1",
              source_path: "/resources/start-vending",
              landing_path: "/apply",
              first_landing_path: "/resources/start-vending",
              latest_landing_path: "/apply",
              source_page_id: "page_1",
              source_block_id: "block_cta",
              source_cta_tracking_name: "hero_apply",
              clicked_href: "/apply",
              utm_source: "facebook",
              utm_medium: "paid_social",
              fbclid: "fbclid-123",
              campaign_id: "camp-456",
              adset_id: "set-456",
              ad_id: "ad-456",
              paid_source_key: "meta_ads:camp-456:set-456:ad-456",
            },
          },
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "lead_created",
          contact_ids: ["cont_created"],
          contacts: [{ id: "cont_created" }],
        }),
      )
      // Follow-up write of the contact-scoped UTM fields.
      .mockResolvedValueOnce(jsonResponse({ id: "cont_created" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_VP_SESSION_ID_FIELD_ID: "cf_vp_session",
        CLOSE_SOURCE_PATH_FIELD_ID: "cf_source_path",
        CLOSE_LANDING_PATH_FIELD_ID: "cf_landing_path",
        CLOSE_FIRST_LANDING_PATH_FIELD_ID: "cf_first_landing",
        CLOSE_LATEST_LANDING_PATH_FIELD_ID: "cf_latest_landing",
        CLOSE_SOURCE_PAGE_ID_FIELD_ID: "cf_source_page",
        CLOSE_SOURCE_BLOCK_ID_FIELD_ID: "cf_source_block",
        CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID: "cf_source_cta",
        CLOSE_CLICKED_HREF_FIELD_ID: "cf_clicked_href",
        CLOSE_UTM_SOURCE_FIELD_ID: "cf_utm_source",
        CLOSE_FBCLID_FIELD_ID: "cf_fbclid",
        CLOSE_CAMPAIGN_ID_FIELD_ID: "cf_campaign",
        CLOSE_ADSET_ID_FIELD_ID: "cf_adset",
        CLOSE_AD_ID_FIELD_ID: "cf_ad",
        CLOSE_PAID_SOURCE_KEY_FIELD_ID: "cf_paid_source",
      }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.close.com/api/v1/lead/",
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        name: "Jane Buyer",
        "custom.cf_vp_session": "vp-session-1",
        "custom.cf_landing_path": "/apply",
        "custom.cf_first_landing": "/resources/start-vending",
        "custom.cf_latest_landing": "/apply",
        "custom.cf_source_page": "page_1",
        "custom.cf_source_block": "block_cta",
        "custom.cf_source_cta": "hero_apply",
        "custom.cf_clicked_href": "/apply",
        "custom.cf_fbclid": "fbclid-123",
        "custom.cf_campaign": "camp-456",
        "custom.cf_adset": "set-456",
        "custom.cf_ad": "ad-456",
        "custom.cf_paid_source": "meta_ads:camp-456:set-456:ad-456",
        contacts: [
          expect.objectContaining({
            name: "Jane Buyer",
            emails: [{ email: "buyer@example.com", type: "direct" }],
            phones: [{ phone: "+14155550101", type: "direct" }],
          }),
        ],
      }),
    );
    // The contact does not exist until the lead is created, so its contact-scoped
    // fields (UTMs + the submitting page) are written in a follow-up call rather
    // than nested in the create. source_path must NOT ride the lead payload:
    // Close 400s the whole lead update when a contact-scoped ID appears on it.
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.close.com/api/v1/contact/cont_created/",
    );
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      "custom.cf_source_path": "/resources/start-vending",
      "custom.cf_utm_source": "facebook",
    });

    expect(fake.state.events[0]).toMatchObject({
      status: "synced",
      close_lead_id: "lead_created",
      close_contact_id: "cont_created",
    });
  });

  it("skips parked events so they can't starve retryable ones behind the fetch limit", async () => {
    const fake = buildClient({
      events: [
        // Parked (non-retryable) with the EARLIEST next_retry_at: before the
        // fix this filled the limit-1 window and was filtered out in memory,
        // leaving the pending lead permanently unprocessed.
        makeEvent({
          id: "event_parked",
          status: "needs_review",
          next_retry_at: "2026-06-17T08:00:00.000Z",
        }),
        makeEvent({
          id: "event_pending",
          status: "pending",
          next_retry_at: "2026-06-17T09:00:00.000Z",
        }),
      ],
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

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T10:00:00.000Z"),
      maxEvents: 1,
    });

    expect(result).toMatchObject({ scanned: 1, synced: 1 });
    expect(
      fake.state.events.find((e) => e.id === "event_pending")?.status,
    ).toBe("synced");
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
              score: 82,
              band: "top_closers",
            },
            normalized: {
              state_market: "SA",
              available_capital: "$25k-$50k",
              consent: true,
              contact_preference: true,
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
      .mockResolvedValueOnce(jsonResponse({ id: "lead_close_1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_1" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_QUALIFICATION_STATUS_FIELD_ID: "cf_status",
        CLOSE_STATE_MARKET_FIELD_ID: "cf_state",
        CLOSE_AVAILABLE_CAPITAL_FIELD_ID: "cf_capital",
        CLOSE_SCORE_FIELD_ID: "cf_score",
        CLOSE_BAND_FIELD_ID: "cf_band",
        CLOSE_CONSENT_STATUS_FIELD_ID: "cf_consent",
        CLOSE_CONTACT_PREFERENCE_FIELD_ID: "cf_sms",
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
    // Lead-scoped analytics fields go on the lead.
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.close.com/api/v1/lead/lead_close_1/",
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      "custom.cf_status": "qualified",
      "custom.cf_score": 82,
      "custom.cf_band": "top_closers",
    });
    // Contact-scoped answer/consent fields go on the contact — sending these to
    // the lead makes Close reject the whole update with a 400.
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.close.com/api/v1/contact/cont_close_1/",
    );
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      "custom.cf_state": "SA",
      "custom.cf_capital": "$25k-$50k",
      "custom.cf_consent": "true",
      "custom.cf_sms": "true",
    });
  });

  it("syncs newsletter consent without presenting it as qualification", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          event_type: "newsletter_enrichment",
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
          payload: {
            qualification: {
              status: "newsletter_subscribed",
              phase: "subscribed",
            },
            normalized: { consent: true },
            answers: [{ label: "Send me The Route", value: "true" }],
          },
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "acti_note_newsletter" }))
      .mockResolvedValueOnce(jsonResponse({ id: "cont_close_1" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_CONSENT_STATUS_FIELD_ID: "cf_consent",
      }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T10:00:00.000Z"),
    });

    expect(result).toMatchObject({ synced: 1 });
    const note = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      note_html: string;
    };
    expect(note.note_html).toContain("The Route newsletter signup");
    expect(note.note_html).not.toContain("Qualification completed");
    expect(note.note_html).not.toContain("qualified");
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      "custom.cf_consent": "true",
    });
  });

  it("omits score and band custom fields when qualification payload leaves them null", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          event_type: "qualification_enrichment",
          close_lead_id: "lead_close_1",
          close_contact_id: "cont_close_1",
          payload: {
            qualification: {
              status: "qualified",
              score: null,
              band: null,
            },
            normalized: {},
            answers: [],
          },
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "acti_note_2" }))
      .mockResolvedValueOnce(jsonResponse({ id: "lead_close_1" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_QUALIFICATION_STATUS_FIELD_ID: "cf_status",
        CLOSE_SCORE_FIELD_ID: "cf_score",
        CLOSE_BAND_FIELD_ID: "cf_band",
      }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T10:00:00.000Z"),
    });

    expect(result).toMatchObject({ synced: 1 });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      "custom.cf_status": "qualified",
    });
  });

  it("needs-review when contact-scoped fields have no Close contact to land on", async () => {
    const fake = buildClient({
      events: [
        makeEvent({
          event_type: "qualification_enrichment",
          lead_submission_id: null,
          close_lead_id: "lead_close_1",
          close_contact_id: null,
          payload: {
            qualification: { status: "qualified" },
            normalized: { consent: true, contact_preference: true },
            answers: [],
          },
        }),
      ],
      leads: [],
    });
    // Only the note POST should fire; the contact-scoped update must not be
    // sent to the lead, and with no contact ID the event parks for retry.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "acti_note_guard" }));

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({
        CLOSE_API_KEY: "close_key_123",
        CLOSE_CONSENT_STATUS_FIELD_ID: "cf_consent",
        CLOSE_CONTACT_PREFERENCE_FIELD_ID: "cf_sms",
      }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T10:00:00.000Z"),
    });

    expect(result).toMatchObject({ synced: 0, needsReview: 1 });
    // No PUT to /lead/ or /contact/ — the person fields were never written.
    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).not.toContain(
      "https://api.close.com/api/v1/lead/lead_close_1/",
    );
    expect(urls.some((url) => String(url).includes("/contact/"))).toBe(false);
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

  it("keeps draining the batch when one event's bookkeeping write fails", async () => {
    const fake = buildClient({
      events: [
        makeEvent({ id: "event_bad", dedupe_key: "bad" }),
        makeEvent({ id: "event_good", dedupe_key: "good" }),
      ],
      failEventUpdatesFor: "event_bad",
    });

    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") return jsonResponse({ data: [] });
      if (String(url).endsWith("/lead/")) {
        return jsonResponse({
          id: "lead_created",
          contact_ids: ["cont_created"],
          contacts: [{ id: "cont_created" }],
        });
      }
      return jsonResponse({ id: "cont_created" });
    });

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    // The healthy event behind the broken one still gets processed.
    expect(result.scanned).toBe(2);
    expect(result.synced).toBe(1);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ eventId: "event_bad" }),
    );
  });

  it("retries qualification enrichment that arrives before its Close lead exists", async () => {
    // The lead_create_or_update event normally drains first and populates
    // close_lead_id. A transient Close 5xx on that event pushes its
    // next_retry_at forward and inverts the order. Parking the enrichment as
    // needs_review here is terminal, so the score, band, and answers would
    // never reach Close and nothing would alert.
    const fake = buildClient({
      events: [
        makeEvent({
          event_type: "qualification_enrichment",
          close_lead_id: null,
          payload: { qualification: { status: "qualified" } },
        }),
      ],
      leads: [makeLead({ close_lead_id: null })],
    });

    const result = await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: vi.fn() as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    expect(result.needsReview).toBe(0);
    expect(result.failed).toBe(1);
    expect(fake.state.events[0].status).toBe("failed");
  });

  it("lets only one of two concurrent drains process an event", async () => {
    // The queue is drained by the cron and by an after() hook on both form
    // submit stages, so overlapping runs are routine. Without an exclusive
    // claim both runs call createLead and one person gets two Close records.
    const fake = buildClient();
    const closeCalls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      closeCalls.push({ method, url: String(url) });
      if (method === "GET") return jsonResponse({ data: [] });
      if (String(url).endsWith("/lead/")) {
        return jsonResponse({
          id: "lead_created",
          contact_ids: ["cont_created"],
          contacts: [{ id: "cont_created" }],
        });
      }
      return jsonResponse({ id: "cont_created" });
    });

    const run = () =>
      adminRunCloseSync({
        client: fake.client,
        closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
        fetchImpl: fetchMock as unknown as typeof fetch,
        now: () => new Date("2026-06-17T09:00:00.000Z"),
      });

    const [first, second] = await Promise.all([run(), run()]);

    const leadCreates = closeCalls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/lead/"),
    );
    expect(leadCreates).toHaveLength(1);
    expect(first.synced + second.synced).toBe(1);
    expect(fake.state.events[0].status).toBe("synced");
    // The loser must not report a failure — nothing went wrong for it.
    expect(first.failed + second.failed).toBe(0);
  });

  it("leases a claimed event so a later drain does not re-list it", async () => {
    const fake = buildClient();
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") return jsonResponse({ data: [] });
      if (String(url).endsWith("/lead/")) {
        return jsonResponse({
          id: "lead_created",
          contact_ids: ["cont_created"],
          contacts: [{ id: "cont_created" }],
        });
      }
      return jsonResponse({ id: "cont_created" });
    });

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv({ CLOSE_API_KEY: "close_key_123" }),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    // The claim pushed next_retry_at past the drain that would run a minute
    // later, so a crashed attempt is retried on lease expiry rather than
    // being picked up while the first attempt is still in flight.
    expect(
      new Date(fake.state.events[0].next_retry_at ?? 0).getTime(),
    ).toBeGreaterThan(new Date("2026-06-17T09:01:00.000Z").getTime());
  });
});

describe("Close tagging fields", () => {
  const TAGGING_ENV = {
    CLOSE_API_KEY: "close_key_123",
    CLOSE_ENTRY_SOURCE_FIELD_ID: "cf_entry_source",
    CLOSE_RESOURCE_TAG_FIELD_ID: "cf_resource_tag",
    CLOSE_RECAPTURE_STATE_FIELD_ID: "cf_recapture_state",
    CLOSE_EVER_HAD_CALL_FIELD_ID: "cf_ever_had_call",
  };

  async function createdLeadBody(lead: Partial<LeadRow>) {
    const fake = buildClient({ leads: [makeLead(lead)] });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "lead_created",
          contact_ids: ["cont_created"],
          contacts: [{ id: "cont_created" }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "cont_created" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv(TAGGING_ENV),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    const create = fetchMock.mock.calls.find(
      (call) => call[0] === "https://api.close.com/api/v1/lead/",
    );
    return JSON.parse(create?.[1]?.body as string) as Record<string, unknown>;
  }

  it("tags a lead-magnet submission with the sales team's tag for that magnet", async () => {
    const body = await createdLeadBody({
      latest_qualification_form_id: LEAD_MAGNET_FORM_ID,
      source_path: "/resources/finance-templates",
    });

    expect(body).toMatchObject({
      "custom.cf_entry_source": "Lead-Magnet",
      "custom.cf_resource_tag": CLOSE_RESOURCE_TAGS.financeTemplates,
    });
  });

  // Close's Lane 2 reconciler owns Recapture State and Ever Had Call. Writing
  // them from here could change which leads that automation picks up.
  //
  // Asserted at the config layer, not just the payload: a payload-only check
  // passes for the wrong reason once the config key is gone, so it would not
  // notice someone re-adding the whole plumbing. This fails the moment the
  // fields become reachable again, which is the thing we actually care about.
  it("never writes the fields Close's Lane 2 automation owns", async () => {
    const config = closeConfigFromEnv(TAGGING_ENV);
    expect(config.customFields).not.toHaveProperty("recaptureStateFieldId");
    expect(config.customFields).not.toHaveProperty("everHadCallFieldId");

    const body = await createdLeadBody({
      latest_qualification_form_id: LEAD_MAGNET_FORM_ID,
      source_path: "/resources/roadmap",
    });

    expect(body).not.toHaveProperty("custom.cf_recapture_state");
    expect(body).not.toHaveProperty("custom.cf_ever_had_call");
  });

  // The roadmap must land in the tag Close already reports on, not a new name.
  // Two names for one magnet splits it across two buckets in their reporting.
  it("files the roadmap under the existing lead-magnet-90-days tag", async () => {
    const body = await createdLeadBody({
      latest_qualification_form_id: LEAD_MAGNET_FORM_ID,
      source_path: "/resources/roadmap",
    });

    expect(body["custom.cf_resource_tag"]).toBe("lead-magnet-90-days");
  });

  // An unrecognised magnet must send nothing rather than invent a tag inside
  // the sales team's taxonomy.
  it("sends no resource tag for a magnet path it does not know", async () => {
    const body = await createdLeadBody({
      latest_qualification_form_id: LEAD_MAGNET_FORM_ID,
      source_path: "/resources/some-new-magnet",
    });

    expect(body).toMatchObject({ "custom.cf_entry_source": "Lead-Magnet" });
    expect(body).not.toHaveProperty("custom.cf_resource_tag");
  });

  it("tags a newsletter signup as a lead magnet", async () => {
    const body = await createdLeadBody({
      latest_qualification_form_id: NEWSLETTER_FORM_ID,
      source_path: "/newsletter",
    });

    expect(body).toMatchObject({
      "custom.cf_entry_source": "Lead-Magnet",
      "custom.cf_resource_tag": "newsletter",
    });
  });

  it("tags the call-booking form as Website-Apply / website-application", async () => {
    const body = await createdLeadBody({
      latest_qualification_form_id: "a1b2c3d4-0000-4000-8000-000000000001",
      source_path: "/contact",
    });

    expect(body).toMatchObject({
      "custom.cf_entry_source": "Website-Apply",
      "custom.cf_resource_tag": "website-application",
    });
  });

  // A magnet whose landing path is missing must not carry another magnet's tag.
  it("omits the resource tag when the magnet cannot be identified", async () => {
    const body = await createdLeadBody({
      latest_qualification_form_id: LEAD_MAGNET_FORM_ID,
      source_path: null,
      landing_path: null,
    });

    expect(body).toMatchObject({ "custom.cf_entry_source": "Lead-Magnet" });
    expect(body).not.toHaveProperty("custom.cf_resource_tag");
  });

  // Close's workflows own Recapture State / Ever Had Call once the lead exists,
  // and Entry Source is first-touch — an update must never re-send them.
  it("never re-sends tagging fields on an update to a known Close lead", async () => {
    const fake = buildClient({
      leads: [
        makeLead({
          close_lead_id: "lead_existing",
          close_contact_id: "cont_existing",
          latest_qualification_form_id: LEAD_MAGNET_FORM_ID,
          source_path: "/resources/roadmap",
        }),
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "cont_existing" }));

    await adminRunCloseSync({
      client: fake.client,
      closeConfig: closeConfigFromEnv(TAGGING_ENV),
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-06-17T09:00:00.000Z"),
    });

    const bodies = fetchMock.mock.calls.map((call) =>
      String(call[1]?.body ?? ""),
    );
    expect(bodies.join(" ")).not.toContain("cf_entry_source");
    expect(bodies.join(" ")).not.toContain("cf_recapture_state");
    expect(bodies.join(" ")).not.toContain("cf_ever_had_call");
  });
});
