import "server-only";

import { z } from "zod";
import { applyChatbotBookingAttribution } from "@/lib/chatbot/booking-attribution";
import { stampChatbotBookingOnCloseLead } from "@/lib/chatbot/close-booking-note";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { config } from "@/lib/config";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { createCalendlyApiClient } from "@/lib/services/calendly-api";
import { recordCalendlyBooking } from "@/lib/services/calendly-bookings";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * The embed's `calendly.event_scheduled` postMessage, turned into a verified
 * booking on the conversation.
 *
 * Nothing from the browser is trusted beyond the invitee URI. The server asks
 * Calendly for that invitee and only proceeds when Calendly's own record says
 * `tracking.utm_content` is this session's conversation id, which the embed
 * URL set (see lib/chatbot/booking.ts). The write path is the webhook's own
 * (`recordCalendlyBooking` + `applyChatbotBookingAttribution`), so a webhook
 * for the same event arriving later is a no-op, and the visitor sees the
 * confirmation card seconds after booking instead of never.
 */
const bookedRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(200),
  inviteeUri: z
    .string()
    .trim()
    .url()
    .max(300)
    .refine((value) => value.startsWith("https://api.calendly.com/"), {
      message: "inviteeUri must be a Calendly API resource",
    }),
});

const NOT_FOUND = { message: "Not found." };

export async function POST(request: Request) {
  const ip = requestIp(request.headers);
  const allowed = await checkPublicRateLimit("chatbot_booked", { ip });
  if (!allowed) {
    return Response.json(
      { message: TOO_MANY_REQUESTS_MESSAGE },
      { status: 429 },
    );
  }

  const parsed = bookedRequestSchema.safeParse(await safeJson(request));
  if (!parsed.success) {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }
  const { sessionId, inviteeUri } = parsed.data;

  const client = createAdminClient();
  const { data: conversation } = await client
    .from("chatbot_conversations")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!conversation) return Response.json(NOT_FOUND, { status: 404 });

  let event: CalendlyWebhookEvent;
  try {
    const calendly = createCalendlyApiClient({
      token: config.CALENDLY_API_TOKEN,
      maxRequests: 4,
    });
    const invitee = await calendly.getInvitee(inviteeUri);
    if (!invitee || invitee.tracking?.utm_content !== conversation.id) {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    const scheduled = invitee.event
      ? await calendly.getScheduledEvent(invitee.event)
      : null;

    event = {
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
      eventStartAt: scheduled?.start_time ?? null,
      eventEndAt: scheduled?.end_time ?? null,
      inviteeCreatedAt: invitee.created_at ?? null,
      // scheduled_event is kept so the admin transcript can say who the
      // call is with (event_memberships) without another Calendly round trip.
      rawPayload: {
        source: "embed_postmessage",
        inviteeUri,
        scheduled_event: scheduled ?? null,
      },
    };
  } catch (error) {
    console.error("chatbot booked: calendly lookup failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ message: "Could not verify." }, { status: 502 });
  }

  try {
    await recordCalendlyBooking(client, event);
  } catch (error) {
    // The conversation stamp below is what the visitor sees; the bookings
    // ledger also gets this event from the webhook and the daily reconcile.
    console.warn("chatbot booked: could not record booking", {
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
    console.warn("chatbot booked: attribution failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const message: ChatbotMessage = {
    role: "assistant",
    content: "Booked. Check your email for the calendar invite.",
    ts: new Date().toISOString(),
    kind: "booking_confirmed",
    data: {
      event_uri: event.scheduledEventUri,
      starts_at: event.eventStartAt,
    },
  };
  return Response.json({ message });
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
