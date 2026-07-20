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
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "spring",
  utmTerm: "vending",
  utmContent: "hero",
  scheduledEventUri: "https://api.calendly.com/scheduled_events/abc",
  scheduledEventName: "Discovery Call",
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
}: {
  matchingLead?: { id: string } | null;
  leadSelectError?: Record<string, unknown> | null;
  upsertError?: Record<string, unknown> | null;
} = {}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: matchingLead, error: leadSelectError });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });

  const upsert = vi.fn().mockResolvedValue({ error: upsertError });

  const from = vi.fn((table: string) => {
    if (table === "lead_submissions") return { select };
    if (table === "calendly_bookings") return { upsert };
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    mocks: { from, select, eq, order, limit, maybeSingle, upsert },
  };
}

describe("recordCalendlyBooking", () => {
  it("inserts a booked row for invitee.created", async () => {
    const { client, mocks } = buildCalendlyClient({
      matchingLead: { id: "lead-1" },
    });

    const result = await recordCalendlyBooking(client, createdEvent);

    expect(result).toEqual({ ok: true, bookingMatchedLead: true });
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
      { onConflict: "invitee_uri" },
    );
  });

  it("upserts a canceled row for invitee.canceled", async () => {
    const { client, mocks } = buildCalendlyClient({
      matchingLead: { id: "lead-1" },
    });

    const result = await recordCalendlyBooking(client, canceledEvent);

    expect(result).toEqual({ ok: true, bookingMatchedLead: true });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        invitee_uri: canceledEvent.inviteeUri,
        event_kind: "invitee.canceled",
        status: "canceled",
        cancel_reason: "Schedule conflict",
        lead_submission_id: "lead-1",
      }),
      { onConflict: "invitee_uri" },
    );
    const upsertedRow = mocks.upsert.mock.calls[0][0];
    expect(typeof upsertedRow.canceled_at).toBe("string");
  });

  it("sets lead_submission_id to null when no matching lead exists", async () => {
    const { client, mocks } = buildCalendlyClient({ matchingLead: null });

    const result = await recordCalendlyBooking(client, createdEvent);

    expect(result).toEqual({ ok: true, bookingMatchedLead: false });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_submission_id: null }),
      { onConflict: "invitee_uri" },
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

    expect(result).toEqual({ ok: true, bookingMatchedLead: false });
    expect(mocks.select).not.toHaveBeenCalled();
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
});
