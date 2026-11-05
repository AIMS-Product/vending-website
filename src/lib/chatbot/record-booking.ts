import "server-only";

import { applyChatbotBookingAttribution } from "@/lib/chatbot/booking-attribution";
import { stampChatbotBookingOnCloseLead } from "@/lib/chatbot/close-booking-note";
import type {
  CalendlyInvitee,
  CalendlyScheduledEvent,
} from "@/lib/services/calendly-api";
import { recordCalendlyBooking } from "@/lib/services/calendly-bookings";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * A booking Calendly has confirmed, turned into the same event the live
 * webhook writes. Shared by the embed's postMessage route and the chat's own
 * book_call tool, so a webhook for the same invitee arriving later is a no-op.
 */
export function chatbotInviteeEvent(
  invitee: CalendlyInvitee,
  scheduled: CalendlyScheduledEvent | null,
  createdBy: "embed_postmessage" | "chat_book_call",
): CalendlyWebhookEvent {
  return {
    eventKind: "invitee.created",
    inviteeUri: invitee.uri,
    inviteeName: invitee.name ?? null,
    inviteeEmail: invitee.email ?? null,
    cancelReason: null,
    utmSource: invitee.tracking?.utm_source ?? null,
    utmMedium: invitee.tracking?.utm_medium ?? null,
    utmCampaign: invitee.tracking?.utm_campaign ?? null,
    utmTerm: invitee.tracking?.utm_term ?? null,
    utmContent: invitee.tracking?.utm_content ?? null,
    scheduledEventUri: invitee.event ?? null,
    scheduledEventName: scheduled?.name ?? null,
    eventTypeUri: scheduled?.event_type ?? null,
    eventStartAt: scheduled?.start_time ?? null,
    eventEndAt: scheduled?.end_time ?? null,
    inviteeCreatedAt: invitee.created_at ?? null,
    // Same shape the live webhook and the backfill sweep store: every reader
    // of raw_payload reads `payload -> created_at` (see AGENTS.md). The
    // scheduled_event stays nested so the admin transcript can name the host.
    rawPayload: {
      event: "invitee.created",
      created_by: createdBy,
      payload: {
        ...invitee,
        invitee_scheduled_by: invitee.scheduled_by ?? null,
        scheduled_event: scheduled ?? null,
      },
    },
  };
}

/**
 * Ledger row, conversation stamp, Close note. Each step logs and carries on:
 * the webhook and the daily reconcile also write the ledger, and the visitor's
 * confirmation must not hang on a Close outage.
 */
export async function recordChatbotBooking(
  client: AdminClient,
  event: CalendlyWebhookEvent,
  label: string,
): Promise<void> {
  try {
    await recordCalendlyBooking(client, event);
  } catch (error) {
    console.warn(`${label}: could not record booking`, {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }

  try {
    const attribution = await applyChatbotBookingAttribution(client, event);
    if (attribution.matched && attribution.action === "booked") {
      await stampChatbotBookingOnCloseLead({
        conversationId: attribution.conversationId,
        attributionSource: attribution.attributionSource,
        scheduledEventName: event.scheduledEventName,
        eventStartAt: event.eventStartAt,
      });
    }
  } catch (error) {
    console.warn(`${label}: attribution failed`, {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
