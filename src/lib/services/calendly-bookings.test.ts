import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordCalendlyBooking } from "./calendly-bookings";
import type { CalendlyWebhookEvent } from "./calendly-webhook";
import type { Database } from "@/types/database";

const createdEvent: CalendlyWebhookEvent = {
  eventKind: "invitee.created",
  inviteeUri: "https://api.calendly.com/scheduled_events/abc/invitees/123",
  inviteeName: "Jane Applicant",
  inviteeEmail: "Jane@Example.com",
  cancelReason: null,
  inviteeCreatedAt: "2026-08-20T09:00:00.000Z",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "spring",
  utmTerm: "vending",
  utmContent: "hero",
  scheduledEventUri: "https://api.calendly.com/scheduled_events/abc",
  scheduledEventName: "Discovery Call",
  eventTypeUri: "https://api.calendly.com/event_types/abc",
  eventStartAt: "2026-08-01T15:00:00.000000Z",
  eventEndAt: "2026-08-01T15:30:00.000000Z",
  rawPayload: { event: "invitee.created" },
};

const canceledEvent: CalendlyWebhookEvent = {
  ...createdEvent,
  eventKind: "invitee.canceled",
  cancelReason: "Schedule conflict",
  rawPayload: { event: "invitee.canceled" },
};

function buildCalendlyClient({
  matchingLead = null,
  leadSelectError = null,
  upsertError = null,
  insertedRows = [{ invitee_uri: "inserted" }],
  updatedRows = [] as Array<{ invitee_uri: string }>,
  updateError = null,
}: {
  matchingLead?: { id: string } | null;
  leadSelectError?: Record<string, unknown> | null;
  upsertError?: Record<string, unknown> | null;
  insertedRows?: Array<{ invitee_uri: string }>;
  updatedRows?: Array<{ invitee_uri: string }>;
  updateError?: Record<string, unknown> | null;
} = {}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: matchingLead, error: leadSelectError });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });

  // The cancellation path awaits upsert() directly; the booking path chains
  // .select() to learn whether a row was inserted (ON CONFLICT DO NOTHING).
  const upsertSelect = vi.fn().mockResolvedValue({
    data: upsertError ? null : insertedRows,
    error: upsertError,
  });
  const upsert = vi.fn((_row: Record<string, unknown>, _options?: unknown) =>
    Object.assign(Promise.resolve({ error: upsertError }), {
      select: upsertSelect,
    }),
  );
  const updateSelect = vi
    .fn()
    .mockResolvedValue({ data: updatedRows, error: updateError });
  const neq = vi.fn().mockReturnValue({ select: updateSelect });
  const updateEq = vi.fn().mockReturnValue({ neq });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const from = vi.fn((table: string) => {
    if (table === "lead_submissions") return { select };
    if (table === "calendly_bookings") return { upsert, update };
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    mocks: {
      from,
      select,
      eq,
      order,
      limit,
      maybeSingle,
      upsert,
      update,
      updateEq,
      neq,
    },
  };
}

describe("recordCalendlyBooking", () => {
  it("inserts a booked row for invitee.created", async () => {
    const { client, mocks } = buildCalendlyClient({
      matchingLead: { id: "lead-1" },
    });

    const result = await recordCalendlyBooking(client, createdEvent);

    expect(result).toEqual({
      ok: true,
      bookingMatchedLead: true,
      applied: true,
    });
    expect(mocks.eq).toHaveBeenCalledWith("email", "jane@example.com");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        invitee_uri: createdEvent.inviteeUri,
        event_kind: "invitee.created",
        status: "booked",
        canceled_at: null,
        cancel_reason: null,
        lead_submission_id: "lead-1",
        utm_source: "google",
      }),
      expect.objectContaining({ onConflict: "invitee_uri" }),
    );
  });

  it("upserts a canceled row for invitee.canceled", async () => {
    const { client, mocks } = buildCalendlyClient({
      matchingLead: { id: "lead-1" },
    });

    const result = await recordCalendlyBooking(client, canceledEvent);

    expect(result).toEqual({
      ok: true,
      bookingMatchedLead: true,
      applied: true,
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        invitee_uri: canceledEvent.inviteeUri,
        event_kind: "invitee.canceled",
        status: "canceled",
        cancel_reason: "Schedule conflict",
        lead_submission_id: "lead-1",
      }),
      expect.objectContaining({ onConflict: "invitee_uri" }),
    );
    const upsertedRow = mocks.upsert.mock.calls[0][0];
    expect(typeof upsertedRow.canceled_at).toBe("string");
  });

  it("sets lead_submission_id to null when no matching lead exists", async () => {
    const { client, mocks } = buildCalendlyClient({ matchingLead: null });

    const result = await recordCalendlyBooking(client, createdEvent);

    expect(result).toEqual({
      ok: true,
      bookingMatchedLead: false,
      applied: true,
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_submission_id: null }),
      expect.objectContaining({ onConflict: "invitee_uri" }),
    );
  });

  it("skips the lead lookup when the invitee has no email", async () => {
    const { client, mocks } = buildCalendlyClient({
      matchingLead: { id: "lead-1" },
    });
    const eventWithoutEmail: CalendlyWebhookEvent = {
      ...createdEvent,
      inviteeEmail: null,
    };

    const result = await recordCalendlyBooking(client, eventWithoutEmail);

    expect(result).toEqual({
      ok: true,
      bookingMatchedLead: false,
      applied: true,
    });
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("stamps Calendly's booked-at onto a payload that has none", async () => {
    const { client, mocks } = buildCalendlyClient();

    // The chatbot embed confirmation used to store this shape: no `payload`,
    // so `payload -> created_at` was null and the booking left every
    // booked-on number. The writer now fills it from the event.
    await recordCalendlyBooking(client, {
      ...createdEvent,
      rawPayload: { source: "embed_postmessage", scheduled_event: null },
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        raw_payload: {
          source: "embed_postmessage",
          scheduled_event: null,
          payload: { created_at: "2026-08-20T09:00:00.000Z" },
        },
      }),
      expect.objectContaining({ onConflict: "invitee_uri" }),
    );
  });

  it("leaves a payload that already carries Calendly's booked-at alone", async () => {
    const { client, mocks } = buildCalendlyClient();
    const rawPayload = {
      event: "invitee.created",
      payload: { created_at: "2026-07-04T12:00:00.000Z", name: "Jane" },
    };

    await recordCalendlyBooking(client, { ...createdEvent, rawPayload });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ raw_payload: rawPayload }),
      expect.objectContaining({ onConflict: "invitee_uri" }),
    );
  });

  it("does not invent a booked-at when the event has none either", async () => {
    const { client, mocks } = buildCalendlyClient();

    await recordCalendlyBooking(client, {
      ...createdEvent,
      inviteeCreatedAt: null,
      rawPayload: { source: "embed_postmessage" },
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ raw_payload: { source: "embed_postmessage" } }),
      expect.objectContaining({ onConflict: "invitee_uri" }),
    );
  });

  it("throws when the lead lookup fails", async () => {
    const { client } = buildCalendlyClient({
      leadSelectError: { message: "boom" },
    });

    await expect(recordCalendlyBooking(client, createdEvent)).rejects.toThrow(
      "Could not look up lead submission for Calendly booking.",
    );
  });

  it("throws when the upsert fails", async () => {
    const { client } = buildCalendlyClient({
      matchingLead: { id: "lead-1" },
      upsertError: { message: "boom" },
    });

    await expect(recordCalendlyBooking(client, createdEvent)).rejects.toThrow(
      "Could not store Calendly booking.",
    );
  });
  it("inserts a new booking without overwriting an existing row", async () => {
    const { client, mocks } = buildCalendlyClient();

    await recordCalendlyBooking(client, createdEvent);

    expect(mocks.upsert).toHaveBeenCalledWith(expect.anything(), {
      onConflict: "invitee_uri",
      ignoreDuplicates: true,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refreshes an existing booked row, but never a cancelled one", async () => {
    const { client, mocks } = buildCalendlyClient({
      insertedRows: [],
      updatedRows: [{ invitee_uri: createdEvent.inviteeUri }],
    });

    const result = await recordCalendlyBooking(client, createdEvent);

    expect(result.applied).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "booked" }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith(
      "invitee_uri",
      createdEvent.inviteeUri,
    );
    expect(mocks.neq).toHaveBeenCalledWith("status", "canceled");
  });

  it("reports a late booking event for a cancelled invitee as not applied", async () => {
    const { client } = buildCalendlyClient({
      insertedRows: [],
      updatedRows: [],
    });

    const result = await recordCalendlyBooking(client, createdEvent);

    expect(result).toEqual({
      ok: true,
      bookingMatchedLead: false,
      applied: false,
    });
  });

  it("throws when the refresh of an existing booking fails", async () => {
    const { client } = buildCalendlyClient({
      insertedRows: [],
      updateError: { message: "boom" },
    });

    await expect(recordCalendlyBooking(client, createdEvent)).rejects.toThrow(
      "Could not store Calendly booking.",
    );
  });

  it("still lets a cancellation overwrite a booking", async () => {
    const { client, mocks } = buildCalendlyClient();

    await recordCalendlyBooking(client, canceledEvent);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled" }),
      { onConflict: "invitee_uri" },
    );
  });
});
