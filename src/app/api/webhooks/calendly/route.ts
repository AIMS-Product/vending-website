import { applyChatbotBookingAttribution } from "@/lib/chatbot/booking-attribution";
import { recordCalendlyBooking } from "@/lib/services/calendly-bookings";
import { config } from "@/lib/config";
import {
  parseCalendlyEvent,
  verifyCalendlySignature,
} from "@/lib/services/calendly-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signingKey = config.CALENDLY_WEBHOOK_SIGNING_KEY;
    const signatureHeader = request.headers.get("calendly-webhook-signature");

    if (
      !signingKey ||
      !verifyCalendlySignature(rawBody, signatureHeader, signingKey)
    ) {
      return Response.json({ ok: false }, { status: 401 });
    }

    const event = parseCalendlyEvent(safeJsonParse(rawBody));
    if (!event) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const client = createAdminClient();
    await recordCalendlyBooking(client, event);

    // Chat attribution runs after the booking is safely recorded and never
    // fails the webhook: a retry storm caused by a bookkeeping error would
    // cost real bookings.
    try {
      await applyChatbotBookingAttribution(client, event);
    } catch (error) {
      console.warn("calendly webhook: chatbot attribution failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("calendly webhook failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}

function safeJsonParse(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
