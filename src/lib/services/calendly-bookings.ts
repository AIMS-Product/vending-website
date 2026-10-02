import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import type { Database, Json } from "@/types/database";

type CalendlyBookingInsert =
  Database["public"]["Tables"]["calendly_bookings"]["Insert"];
type CalendlyBookingClient = Pick<SupabaseClient<Database>, "from">;

/**
 * PostgREST path to Calendly's own booked-at: the one date a booking is
 * counted on. `created_at` on the row is when we saved it, which a backfill
 * sets to the day of the backfill. `withBookedAt` below makes every writer
 * fill this path. Select it as `alias:${CALENDLY_BOOKED_AT_PATH}`.
 */
export const CALENDLY_BOOKED_AT_PATH = "raw_payload->payload->>created_at";

export type RecordCalendlyBookingResult = {
  ok: true;
  bookingMatchedLead: boolean;
  /**
   * False when a booking event arrived for an invitee already cancelled and
   * was ignored. Calendly gives a rescheduled call a new invitee, so a
   * cancelled invitee is final; callers skip follow-on work for it.
   */
  applied: boolean;
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

  const bookingMatchedLead = Boolean(leadSubmissionId);

  if (row.status === "canceled") {
    const { error } = await client
      .from("calendly_bookings")
      .upsert(row, { onConflict: "invitee_uri" });
    if (error) {
      throw new CalendlyBookingServiceError(
        "Could not store Calendly booking.",
      );
    }
    return { ok: true, bookingMatchedLead, applied: true };
  }

  return {
    ok: true,
    bookingMatchedLead,
    applied: await storeBooked(client, row),
  };
}

/**
 * Calendly retries failed deliveries for a day and does not promise order, so
 * a booking event can land after its cancellation. Insert if new; otherwise
 * update only a row that is not cancelled, so a late booking event can never
 * bring a cancelled call back. Returns whether the row was written.
 */
async function storeBooked(
  client: CalendlyBookingClient,
  row: CalendlyBookingInsert,
): Promise<boolean> {
  const inserted = await client
    .from("calendly_bookings")
    .upsert(row, { onConflict: "invitee_uri", ignoreDuplicates: true })
    .select("invitee_uri");
  if (inserted.error) {
    throw new CalendlyBookingServiceError("Could not store Calendly booking.");
  }
  if ((inserted.data ?? []).length > 0) return true;

  const updated = await client
    .from("calendly_bookings")
    .update(row)
    .eq("invitee_uri", row.invitee_uri)
    .neq("status", "canceled")
    .select("invitee_uri");
  if (updated.error) {
    throw new CalendlyBookingServiceError("Could not store Calendly booking.");
  }
  return (updated.data ?? []).length > 0;
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
