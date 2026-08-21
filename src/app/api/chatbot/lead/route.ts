import "server-only";

import { z } from "zod";
import { loadChatbotConfig } from "@/lib/chatbot/config";
import {
  loadOrCreateConversation,
  persistConversationTurn,
  toChatbotMessages,
} from "@/lib/chatbot/conversation-store";
import { handleChatbotLeadCaptured } from "@/lib/chatbot/lead-capture";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pre-chat gate form and on-intent capture card both post here (see
 * ChatCaptureForm.tsx) — a lighter-weight sibling to /api/chatbot/chat that
 * only records contact info, no model call. Stricter rate limit than chat
 * itself: it's the one endpoint here that always writes a lead.
 */
const leadRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(200),
  name: z.string().trim().max(140).nullable().optional(),
  // submitLead (via handleChatbotLeadCaptured) re-validates and normalizes
  // this itself (trim + lowercase, see lead-source-fields.ts emailText()) —
  // this is just an early, cheap reject for an obviously-bad address.
  email: z.email().max(320),
  phone: z.string().trim().max(60).nullable().optional(),
  pageUrl: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const config = await loadChatbotConfig();
  if (!config.enabled) {
    return Response.json(
      { message: "Chat is not available." },
      { status: 404 },
    );
  }

  const ip = requestIp(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        message: parsed.error.issues[0]?.message ?? "Invalid capture request.",
      },
      { status: 400 },
    );
  }
  const { sessionId, name, email, phone, pageUrl } = parsed.data;

  const allowed = await checkPublicRateLimit("chatbot_lead", { ip, email });
  if (!allowed) {
    return Response.json(
      { message: TOO_MANY_REQUESTS_MESSAGE },
      { status: 429 },
    );
  }

  const client = createAdminClient();

  let conversation;
  try {
    conversation = await loadOrCreateConversation(
      {
        sessionId,
        pageUrl: pageUrl ?? null,
        userAgent: request.headers.get("user-agent"),
        visitorHash: null,
      },
      { client },
    );
  } catch (error) {
    console.error("chatbot: could not load conversation for lead capture", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return Response.json(
      { message: "Could not save your details." },
      { status: 500 },
    );
  }

  const isNewCapture =
    !conversation.captured_email && !conversation.captured_phone;
  const capturedName = name || conversation.captured_name;
  const capturedPhone = phone || conversation.captured_phone;

  try {
    await persistConversationTurn(
      conversation,
      {
        messages: toChatbotMessages(conversation.messages),
        capturedName,
        capturedEmail: email,
        capturedPhone,
        pageUrl: pageUrl ?? null,
      },
      { client },
    );
  } catch (error) {
    console.error("chatbot: could not persist captured contact info", {
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return Response.json(
      { message: "Could not save your details." },
      { status: 500 },
    );
  }

  if (isNewCapture) {
    await handleChatbotLeadCaptured(
      {
        conversationId: conversation.id,
        sessionId,
        name: capturedName,
        email,
        phone: capturedPhone,
        pageUrl: pageUrl ?? null,
      },
      { client },
    );
  }

  return Response.json({ ok: true });
}
