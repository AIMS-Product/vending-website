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
      raw_payload: event.rawPayload as Json,
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
    raw_payload: event.rawPayload as Json,
    ...attribution,
  };
}
