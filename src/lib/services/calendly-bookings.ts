import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import type { Database, Json } from "@/types/database";

type CalendlyBookingInsert =
  Database["public"]["Tables"]["calendly_bookings"]["Insert"];
type CalendlyBookingClient = Pick<SupabaseClient<Database>, "from">;

export type RecordCalendlyBookingResult = {
  ok: true;
  bookingMatchedLead: boolean;
};

export class CalendlyBookingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendlyBookingServiceError";
  }
}

/**
 * Records a Calendly invitee event (booking or cancellation) idempotently,
 * keyed on the Calendly invitee URI, and links it to the most recently
 * matching lead submission by email when one exists.
 */
export async function recordCalendlyBooking(
  client: CalendlyBookingClient,
  event: CalendlyWebhookEvent,
): Promise<RecordCalendlyBookingResult> {
  const leadSubmissionId = await findMatchingLeadId(client, event.inviteeEmail);
  const row = buildBookingRow(event, leadSubmissionId);

  const { error } = await client
    .from("calendly_bookings")
    .upsert(row, { onConflict: "invitee_uri" });

  if (error) {
    throw new CalendlyBookingServiceError("Could not store Calendly booking.");
  }

  return { ok: true, bookingMatchedLead: Boolean(leadSubmissionId) };
}

async function findMatchingLeadId(
  client: CalendlyBookingClient,
  inviteeEmail: string | null,
): Promise<string | null> {
  if (!inviteeEmail) return null;

  const normalizedEmail = inviteeEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await client
    .from("lead_submissions")
    .select("id")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new CalendlyBookingServiceError(
      "Could not look up lead submission for Calendly booking.",
    );
  }

  return data?.id ?? null;
}

/**
 * Every reader dates a booking from `raw_payload -> payload -> created_at`:
 * Calendly's own record of when it was booked. Our row-insert time must never
 * stand in for it, so a payload without it drops the booking out of every
 * booked-on number rather than dating it wrongly.
 *
 * The live webhook body already carries it. The callers that build a payload
 * themselves have to supply it, and the chatbot embed confirmation did not,
 * which silently kept four September consultation calls out of the daily
 * pace. The guard lives here because all three callers write through this one
 * function.
 */
function withBookedAt(
  rawPayload: unknown,
  inviteeCreatedAt: string | null,
): Json {
  if (!inviteeCreatedAt) return rawPayload as Json;
  const root = isRecord(rawPayload) ? rawPayload : {};
  const payload = isRecord(root.payload) ? root.payload : {};
  if (typeof payload.created_at === "string" && payload.created_at.trim()) {
    return rawPayload as Json;
  }
  return {
    ...root,
    payload: { ...payload, created_at: inviteeCreatedAt },
  } as Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildBookingRow(
  event: CalendlyWebhookEvent,
  leadSubmissionId: string | null,
): CalendlyBookingInsert {
  const attribution = {
    utm_source: event.utmSource,
    utm_medium: event.utmMedium,
    utm_campaign: event.utmCampaign,
    utm_term: event.utmTerm,
    utm_content: event.utmContent,
  };

  if (event.eventKind === "invitee.canceled") {
    return {
      invitee_uri: event.inviteeUri,
      event_kind: event.eventKind,
      status: "canceled",
      invitee_name: event.inviteeName,
      invitee_email: event.inviteeEmail,
      scheduled_event_name: event.scheduledEventName,
      scheduled_event_uri: event.scheduledEventUri,
      event_start_at: event.eventStartAt,
      event_end_at: event.eventEndAt,
      canceled_at: new Date().toISOString(),
      cancel_reason: event.cancelReason,
      lead_submission_id: leadSubmissionId,
      raw_payload: withBookedAt(event.rawPayload, event.inviteeCreatedAt),
      ...attribution,
    };
  }

  return {
    invitee_uri: event.inviteeUri,
    event_kind: event.eventKind,
    status: "booked",
    invitee_name: event.inviteeName,
    invitee_email: event.inviteeEmail,
    scheduled_event_name: event.scheduledEventName,
    scheduled_event_uri: event.scheduledEventUri,
    event_start_at: event.eventStartAt,
    event_end_at: event.eventEndAt,
    canceled_at: null,
    cancel_reason: null,
    lead_submission_id: leadSubmissionId,
    raw_payload: withBookedAt(event.rawPayload, event.inviteeCreatedAt),
    ...attribution,
  };
}
