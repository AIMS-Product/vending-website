import "server-only";

import { z } from "zod";
import { chatbotBookingUrl } from "@/lib/chatbot/booking";
import { loadChatbotConfig } from "@/lib/chatbot/config";
import { publicConfig } from "@/lib/config";
import { toChatbotMessages } from "@/lib/chatbot/conversation-store";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rehydrates a visitor's transcript after a page navigation wipes the
 * widget's in-memory state — the conversation row already survives
 * server-side under `sessionId` (see conversation-store.ts), this just reads
 * it back. `sessionId` is an unguessable client-generated UUID and IS the
 * access token here, same trust model /api/chatbot/chat uses for the same
 * value.
 */
const historyRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(200),
});

// One shape for every "nothing to hydrate" case (disabled, bad sessionId, no
// matching conversation) — the widget treats all three identically.
const NOT_FOUND_RESPONSE = { message: "Not found." };

export async function GET(request: Request) {
  const config = await loadChatbotConfig();
  if (!config.enabled) {
    return Response.json(NOT_FOUND_RESPONSE, { status: 404 });
  }

  const ip = requestIp(request.headers);
  const allowed = await checkPublicRateLimit("chatbot_history", { ip });
  if (!allowed) {
    return Response.json(
      { message: TOO_MANY_REQUESTS_MESSAGE },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = historyRequestSchema.safeParse({
    sessionId: searchParams.get("sessionId") ?? "",
  });
  if (!parsed.success) {
    return Response.json(NOT_FOUND_RESPONSE, { status: 404 });
  }

  const client = createAdminClient();
  const { data } = await client
    .from("chatbot_conversations")
    .select("id,messages,status,captured_name,captured_email,captured_phone")
    .eq("session_id", parsed.data.sessionId)
    .maybeSingle();

  if (!data) {
    return Response.json(NOT_FOUND_RESPONSE, { status: 404 });
  }

  return Response.json(
    {
      // `kind`/`data` ride along so a rehydrated transcript shows the same
      // inline calendar and resource cards the visitor saw before they
      // navigated — dropping them would silently downgrade the booking
      // calendar to a plain sentence on every page change.
      messages: toChatbotMessages(data.messages).map(
        ({ role, content, kind, data: messageData }) => ({
          role,
          content,
          ...(kind ? { kind, data: messageData ?? null } : {}),
        }),
      ),
      status: data.status,
      captured: Boolean(data.captured_email || data.captured_phone),
      // The conversation-tagged Calendly URL, so the widget can open the
      // calendar on exit intent without the visitor sending another turn.
      // Built here rather than in the browser because the conversation id is
      // the attribution key and never leaves the server otherwise.
      bookingUrl: chatbotBookingUrl({
        conversationId: data.id,
        name: data.captured_name,
        email: data.captured_email,
        embed: true,
        embedDomain: siteHostname(),
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Calendly requires the embedding page's domain on an inline embed. */
function siteHostname(): string | null {
  try {
    return new URL(publicConfig.siteUrl).hostname;
  } catch {
    return null;
  }
}
