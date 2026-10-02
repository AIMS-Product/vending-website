import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Delivery semantics of the Calendly webhook, run through the REAL
 * `recordCalendlyBooking` against an in-memory table that honours
 * `upsert(..., { onConflict })`. route.test.ts mocks the recorder, so it
 * cannot say what happens when Calendly redelivers or reorders events.
 */

const SIGNING_KEY = "whsec_delivery_test_key";
const INVITEE_URI =
  "https://api.calendly.com/scheduled_events/abc/invitees/123";

type StoredRow = Record<string, unknown> & { invitee_uri: string };

const mocks = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  upsertCalls: [] as Array<Record<string, unknown>>,
  upsertError: { value: null as { message: string } | null },
  applyAttribution: vi.fn(),
  stamp: vi.fn(),
  order: [] as string[],
}));

vi.mock("@/lib/config", () => ({
  get config() {
    return { CALENDLY_WEBHOOK_SIGNING_KEY: "whsec_delivery_test_key" };
  },
}));

vi.mock("@/lib/chatbot/booking-attribution", () => ({
  applyChatbotBookingAttribution: mocks.applyAttribution,
}));

vi.mock("@/lib/chatbot/close-booking-note", () => ({
  stampChatbotBookingOnCloseLead: mocks.stamp,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "lead_submissions") {
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "eq", "order", "limit"]) {
          chain[method] = () => chain;
        }
        chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
        return chain;
      }
      if (table === "calendly_bookings") {
        return {
          upsert(
            row: StoredRow,
            options: { onConflict: string },
          ): Promise<{ error: { message: string } | null }> {
            mocks.order.push("upsert");
            mocks.upsertCalls.push({ row, options });
            if (mocks.upsertError.value) {
              return Promise.resolve({ error: mocks.upsertError.value });
            }
            // Last write wins on the conflict column, as Postgres does.
            expect(options.onConflict).toBe("invitee_uri");
            mocks.store.set(row.invitee_uri, row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { POST } = await import("./route");

function payload(event: "invitee.created" | "invitee.canceled") {
  return {
    event,
    payload: {
      uri: INVITEE_URI,
      name: "Jane Applicant",
      email: "jane@example.com",
      created_at: "2026-09-18T12:00:00.000000Z",
      ...(event === "invitee.canceled"
        ? { cancellation: { reason: "Schedule conflict" } }
        : {}),
      scheduled_event: {
        uri: "https://api.calendly.com/scheduled_events/abc",
        name: "Discovery Call",
        start_time: "2026-09-20T15:00:00.000000Z",
        end_time: "2026-09-20T15:30:00.000000Z",
      },
    },
  };
}

function deliver(body: unknown) {
  const raw = JSON.stringify(body);
  const seconds = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", SIGNING_KEY)
    .update(`${seconds}.${raw}`)
    .digest("hex");
  return POST(
    new Request("https://www.vendingpreneurs.com/api/webhooks/calendly", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "calendly-webhook-signature": `t=${seconds},v1=${signature}`,
      },
      body: raw,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.store.clear();
  mocks.upsertCalls.length = 0;
  mocks.order.length = 0;
  mocks.upsertError.value = null;
  mocks.applyAttribution.mockImplementation(async () => {
    mocks.order.push("attribution");
    return { matched: false };
  });
  mocks.stamp.mockResolvedValue(undefined);
});

describe("redelivery", () => {
  it("stores one row per invitee however many times the same delivery arrives", async () => {
    const first = await deliver(payload("invitee.created"));
    const second = await deliver(payload("invitee.created"));
    const third = await deliver(payload("invitee.created"));

    expect([first.status, second.status, third.status]).toEqual([
      200, 200, 200,
    ]);
    expect(mocks.store.size).toBe(1);
    expect(mocks.store.get(INVITEE_URI)).toMatchObject({
      status: "booked",
      event_kind: "invitee.created",
      invitee_email: "jane@example.com",
    });
  });

  it("turns the booking into a cancellation when invitee.canceled follows", async () => {
    await deliver(payload("invitee.created"));
    await deliver(payload("invitee.canceled"));

    expect(mocks.store.size).toBe(1);
    expect(mocks.store.get(INVITEE_URI)).toMatchObject({
      status: "canceled",
      event_kind: "invitee.canceled",
      cancel_reason: "Schedule conflict",
    });
    expect(mocks.store.get(INVITEE_URI)?.canceled_at).toEqual(
      expect.any(String),
    );
  });

  it("keeps Calendly's own booked-at on the cancellation row, so the booking stays on its booked day", async () => {
    await deliver(payload("invitee.canceled"));

    const raw = mocks.store.get(INVITEE_URI)?.raw_payload as {
      payload: { created_at: string };
    };
    expect(raw.payload.created_at).toBe("2026-09-18T12:00:00.000000Z");
  });

  // Calendly retries a delivery that got a non-2xx for up to a day, and does
  // not promise ordering. A `created` that failed once (say, a database blip
  // answered 500) and is retried AFTER the `canceled` arrived overwrites the
  // cancellation: the upsert is unconditional last-write-wins on invitee_uri.
  // The live booking the guest cancelled then counts as booked and shows up on
  // the call sheet. Recorded here as a known gap, not fixed: the webhook path
  // is off limits for behaviour changes in this pass.
  it.fails(
    "does not resurrect a cancelled booking when a late invitee.created is redelivered",
    async () => {
      await deliver(payload("invitee.created"));
      await deliver(payload("invitee.canceled"));
      await deliver(payload("invitee.created"));

      expect(mocks.store.get(INVITEE_URI)?.status).toBe("canceled");
    },
  );

  it("documents today's behaviour for that reordering: the late created wins", async () => {
    await deliver(payload("invitee.created"));
    await deliver(payload("invitee.canceled"));
    await deliver(payload("invitee.created"));

    expect(mocks.store.get(INVITEE_URI)).toMatchObject({
      status: "booked",
      canceled_at: null,
      cancel_reason: null,
    });
  });
});

describe("failure handling", () => {
  it("answers 500 so Calendly redelivers, and runs no chat attribution for a booking that was not stored", async () => {
    mocks.upsertError.value = { message: "db down" };

    const response = await deliver(payload("invitee.created"));

    expect(response.status).toBe(500);
    expect(mocks.applyAttribution).not.toHaveBeenCalled();
    expect(mocks.store.size).toBe(0);
  });

  it("stores the booking before it looks at chat attribution", async () => {
    await deliver(payload("invitee.created"));

    expect(mocks.order).toEqual(["upsert", "attribution"]);
  });
});

describe("chat attribution", () => {
  it("stamps the Close lead for a chat booking, with the event the guest booked", async () => {
    mocks.applyAttribution.mockResolvedValue({
      matched: true,
      conversationId: "conv-1",
      action: "booked",
      attributionSource: "in_chat",
    });

    const response = await deliver(payload("invitee.created"));

    expect(response.status).toBe(200);
    expect(mocks.stamp).toHaveBeenCalledWith({
      conversationId: "conv-1",
      attributionSource: "in_chat",
      scheduledEventName: "Discovery Call",
      eventStartAt: "2026-09-20T15:00:00.000000Z",
    });
  });

  it("does not stamp Close for a matched cancellation", async () => {
    mocks.applyAttribution.mockResolvedValue({
      matched: true,
      conversationId: "conv-1",
      action: "canceled",
      attributionSource: "in_chat",
    });

    const response = await deliver(payload("invitee.canceled"));

    expect(response.status).toBe(200);
    expect(mocks.stamp).not.toHaveBeenCalled();
  });

  it("does not stamp Close for a booking that did not come from a chat", async () => {
    const response = await deliver(payload("invitee.created"));

    expect(response.status).toBe(200);
    expect(mocks.stamp).not.toHaveBeenCalled();
  });

  it("still answers 200 when attribution throws, so a bookkeeping error cannot cause a retry storm", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.applyAttribution.mockRejectedValue(new Error("attribution broke"));

    const response = await deliver(payload("invitee.created"));

    expect(response.status).toBe(200);
    expect(mocks.store.size).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      "calendly webhook: chatbot attribution failed",
      { name: "Error" },
    );
    warn.mockRestore();
  });

  it("still answers 200 when the Close stamp throws, and logs no message text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.applyAttribution.mockResolvedValue({
      matched: true,
      conversationId: "conv-1",
      action: "booked",
      attributionSource: "email_match",
    });
    mocks.stamp.mockRejectedValue(new Error("Close said jane@example.com"));

    const response = await deliver(payload("invitee.created"));

    expect(response.status).toBe(200);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("jane@example.com");
    warn.mockRestore();
  });
});
