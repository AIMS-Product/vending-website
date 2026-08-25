import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloseClient } from "@/lib/close/client";
import type { Database, Tables } from "@/types/database";
import {
  CloseWarmReplyNoSenderError,
  queueWarmReplyActivity,
  syncWarmReplyActivity,
  WARM_REPLY_DELAY_MINUTES,
  warmReplyActivityDedupeKey,
  warmReplyActivityMarker,
} from "./warm-reply-activity";

type EventRow = Tables<"close_sync_events">;
type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];
type LeadRow = Tables<"lead_submissions">;

const CAPTURED_AT = new Date("2026-08-25T15:00:00.000Z");

type EmailActivityCall = Parameters<CloseClient["createEmailActivity"]>[0];

function buildQueueClient(
  options: { insertError?: { code?: string; message?: string } } = {},
) {
  const insert = vi.fn((_event: CloseSyncEventInsert) => ({
    select: () => ({
      single: async () => ({
        data: options.insertError ? null : { id: "evt-1" },
        error: options.insertError ?? null,
      }),
    }),
  }));
  const from = vi.fn((table: string) => {
    if (table === "close_sync_events") return { insert };
    throw new Error(`unexpected table ${table}`);
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    insert,
  };
}

const QUEUE_INPUT = {
  leadSubmissionId: "lead-1",
  source: "chatbot" as const,
  fullName: "Test Person",
  email: "test@example.com",
  phone: "+15551234567",
  sourcePath: "/vending-machine-business",
  message: "Captured by the site chatbot.",
  capturedAt: CAPTURED_AT,
};

describe("queueWarmReplyActivity", () => {
  it("queues nothing at all while the flag is off", async () => {
    const { client, insert } = buildQueueClient();
    const result = await queueWarmReplyActivity(client, QUEUE_INPUT, {
      enabled: false,
    });
    expect(result).toBe("disabled");
    // Load-bearing: the event_type CHECK migration is hand-applied to prod, so
    // an insert before it lands would fail. The flag has to stop it reaching
    // the table at all, not just stop the Close write.
    expect(insert).not.toHaveBeenCalled();
  });

  it("becomes due 15 minutes after the capture, not immediately", async () => {
    const { client, insert } = buildQueueClient();
    const result = await queueWarmReplyActivity(client, QUEUE_INPUT, {
      enabled: true,
    });
    expect(result).toBe("queued");

    const event = insert.mock.calls[0][0];
    expect(event.event_type).toBe("warm_reply_activity");
    expect(event.dedupe_key).toBe(warmReplyActivityDedupeKey("lead-1"));
    expect(event.next_retry_at).toBe(
      new Date(
        CAPTURED_AT.getTime() + WARM_REPLY_DELAY_MINUTES * 60_000,
      ).toISOString(),
    );
  });

  it("treats a duplicate dedupe key as already queued", async () => {
    const { client } = buildQueueClient({ insertError: { code: "23505" } });
    await expect(
      queueWarmReplyActivity(client, QUEUE_INPUT, { enabled: true }),
    ).resolves.toBe("exists");
  });

  it("never throws when the insert fails, so a lead submit survives", async () => {
    // This is the CHECK-constraint-not-yet-applied case.
    const { client } = buildQueueClient({
      insertError: { code: "23514", message: "violates check constraint" },
    });
    await expect(
      queueWarmReplyActivity(client, QUEUE_INPUT, { enabled: true }),
    ).resolves.toBe("failed");
  });
});

function buildEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-1",
    lead_submission_id: "lead-1",
    close_lead_id: "lead_close_1",
    close_contact_id: "cont_close_1",
    event_type: "warm_reply_activity",
    payload: {
      source: "chatbot",
      captured_at: CAPTURED_AT.toISOString(),
      contact: {
        full_name: "Test Person",
        email: "test@example.com",
        phone: "+15551234567",
      },
      submission: {
        source_path: "/vending-machine-business",
        message: "Captured by the site chatbot.",
      },
    },
    ...overrides,
  } as EventRow;
}

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    email: "test@example.com",
    full_name: "Test Person",
    phone: "+15551234567",
    source_path: "/vending-machine-business",
    message: null,
    call_booked_at: null,
    close_lead_id: "lead_close_1",
    close_contact_id: "cont_close_1",
    ...overrides,
  } as LeadRow;
}

function buildDrainClient(options: { bookings?: unknown[] } = {}) {
  const from = vi.fn((table: string) => {
    if (table === "calendly_bookings") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        limit: async () => ({ data: options.bookings ?? [], error: null }),
      };
      return chain;
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from } as unknown as Pick<SupabaseClient<Database>, "from">;
}

function buildDrainCloseClient(
  options: { existing?: Array<{ body_text?: string | null }> } = {},
) {
  const createEmailActivity = vi.fn(async (_payload: EmailActivityCall) => ({
    id: "acti_1",
    direction: "incoming",
  }));
  const listLeadEmailActivities = vi.fn(async () => ({
    data: options.existing ?? [],
  }));
  return {
    close: {
      createEmailActivity,
      listLeadEmailActivities,
    } as unknown as CloseClient,
    createEmailActivity,
  };
}

describe("syncWarmReplyActivity", () => {
  it("logs an inbox email activity, which is what makes Close say incoming", async () => {
    const { close, createEmailActivity } = buildDrainCloseClient();
    await syncWarmReplyActivity(buildEvent(), {
      client: buildDrainClient(),
      close,
      lead: buildLead(),
      enabled: true,
    });

    const payload = createEmailActivity.mock.calls[0][0];
    // `direction` is not writable on Close's POST /activity/email/. `inbox` is
    // the only status that yields direction: "incoming", which is the sole
    // thing the warm reply smart list filters on.
    expect(payload.status).toBe("inbox");
    expect(payload).not.toHaveProperty("direction");
    expect(payload.sender).toBe('"Test Person" <test@example.com>');
    expect(payload.lead_id).toBe("lead_close_1");
    // Keyed on the CLOSE lead, not our lead row: one person can have several
    // lead rows resolving to one Close lead.
    expect(payload.body_text).toContain(
      warmReplyActivityMarker("lead_close_1"),
    );
  });

  it("writes no Close fields at all, only the activity", async () => {
    const { close } = buildDrainCloseClient();
    // A client with ONLY the two activity methods: any attempt to touch
    // updateLead (Recapture State, Ever Had Call, entry_source) would throw.
    await expect(
      syncWarmReplyActivity(buildEvent(), {
        client: buildDrainClient(),
        close,
        lead: buildLead(),
        enabled: true,
      }),
    ).resolves.toEqual({ leadId: "lead_close_1", contactId: "cont_close_1" });
  });

  it("skips a lead that Close already recorded a booking for", async () => {
    const { close, createEmailActivity } = buildDrainCloseClient();
    await syncWarmReplyActivity(buildEvent(), {
      client: buildDrainClient(),
      close,
      lead: buildLead({ call_booked_at: "2026-08-25" }),
      enabled: true,
    });
    expect(createEmailActivity).not.toHaveBeenCalled();
  });

  it("skips a lead who booked through the Calendly redirect", async () => {
    const { close, createEmailActivity } = buildDrainCloseClient();
    await syncWarmReplyActivity(buildEvent(), {
      client: buildDrainClient({ bookings: [{ id: "book-1" }] }),
      close,
      lead: buildLead(),
      enabled: true,
    });
    expect(createEmailActivity).not.toHaveBeenCalled();
  });

  it("never logs a second activity for the same lead", async () => {
    const { close, createEmailActivity } = buildDrainCloseClient({
      existing: [
        {
          body_text: `Website reference: ${warmReplyActivityMarker("lead_close_1")}`,
        },
      ],
    });
    await syncWarmReplyActivity(buildEvent(), {
      client: buildDrainClient(),
      close,
      lead: buildLead(),
      enabled: true,
    });
    // A duplicate incoming activity would re-warm a cold lead and drop it back
    // into a same-day SLA list it has already left.
    expect(createEmailActivity).not.toHaveBeenCalled();
  });

  it("does not log a second activity for a SECOND lead row on one Close lead", async () => {
    // /contact and /book-now mint a fresh idempotencyKey on every page render,
    // so a reload gives one person a second lead_submissions row that resolves
    // to the same Close lead. The marker has to be keyed on the Close lead or
    // that person collects one incoming activity per row.
    const { close, createEmailActivity } = buildDrainCloseClient({
      existing: [
        {
          body_text: `Website reference: ${warmReplyActivityMarker("lead_close_1")}`,
        },
      ],
    });
    await syncWarmReplyActivity(
      buildEvent({ id: "evt-2", lead_submission_id: "lead-2" }),
      {
        client: buildDrainClient(),
        close,
        lead: buildLead({ id: "lead-2" }),
        enabled: true,
      },
    );
    expect(createEmailActivity).not.toHaveBeenCalled();
  });

  it("omits contact_id rather than sending an explicit null", async () => {
    const { close, createEmailActivity } = buildDrainCloseClient();
    await syncWarmReplyActivity(buildEvent({ close_contact_id: null }), {
      client: buildDrainClient(),
      close,
      lead: buildLead({ close_contact_id: null }),
      enabled: true,
    });
    expect(createEmailActivity.mock.calls[0][0]).not.toHaveProperty(
      "contact_id",
    );
  });

  it("does nothing when the flag is switched off after events were queued", async () => {
    const { close, createEmailActivity } = buildDrainCloseClient();
    await syncWarmReplyActivity(buildEvent(), {
      client: buildDrainClient(),
      close,
      lead: buildLead(),
      enabled: false,
    });
    expect(createEmailActivity).not.toHaveBeenCalled();
  });

  it("retries rather than parks when the Close lead is not there yet", async () => {
    const { close } = buildDrainCloseClient();
    await expect(
      syncWarmReplyActivity(buildEvent({ close_lead_id: null }), {
        client: buildDrainClient(),
        close,
        lead: buildLead({ close_lead_id: null }),
        enabled: true,
      }),
    ).rejects.not.toBeInstanceOf(CloseWarmReplyNoSenderError);
  });

  it("parks for review when there is no email to be the sender", async () => {
    const { close } = buildDrainCloseClient();
    const event = buildEvent({
      payload: { source: "chatbot", contact: { full_name: "Test Person" } },
    });
    await expect(
      syncWarmReplyActivity(event, {
        client: buildDrainClient(),
        close,
        lead: buildLead({ email: null as unknown as string }),
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(CloseWarmReplyNoSenderError);
  });

  it("holds off rather than guessing when the bookings table is unreadable", async () => {
    const from = vi.fn(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        limit: async () => ({ data: null, error: { message: "boom" } }),
      };
      return chain;
    });
    const { close, createEmailActivity } = buildDrainCloseClient();
    await expect(
      syncWarmReplyActivity(buildEvent(), {
        client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
        close,
        lead: buildLead(),
        enabled: true,
      }),
    ).rejects.toThrow(/bookings/i);
    expect(createEmailActivity).not.toHaveBeenCalled();
  });
});

describe("isBookingIntentForm", () => {
  it("excludes the newsletter form, which shares the qualification intake", async () => {
    const { isBookingIntentForm } = await import("./warm-reply-activity");
    const { NEWSLETTER_FORM_ID } = await import("@/lib/content/newsletter");
    // A newsletter subscriber is not waiting for a call. Logging them as a warm
    // reply would put them in a same-day setter list under "asked about getting
    // started", which is untrue.
    expect(isBookingIntentForm(NEWSLETTER_FORM_ID)).toBe(false);
    expect(isBookingIntentForm("vp-qualification-v3")).toBe(true);
    expect(isBookingIntentForm(null)).toBe(true);
  });
});
