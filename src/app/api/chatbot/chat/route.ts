import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import {
  buildChatbotSystemPrompt,
  type ChatbotPromptInput,
} from "@/lib/chatbot/build-system-prompt";
import {
  CHATBOT_INPUT_LIMITS,
  checkChatbotInputBudget,
  isUnderChatbotDailyCap,
} from "@/lib/chatbot/input-budget";
import { VP_CHAT_VISITOR_COOKIE_NAME } from "@/lib/chatbot/constants";
import {
  loadOrCreateConversation,
  persistConversationTurn,
  prospectSummaryFrom,
  toChatbotMessages,
  type ChatbotMessage,
} from "@/lib/chatbot/conversation-store";
import { loadChatbotConfig } from "@/lib/chatbot/config";
import { publicConfig } from "@/lib/config";
import { extractLead } from "@/lib/chatbot/extract-lead";
import { handleChatbotLeadCaptured } from "@/lib/chatbot/lead-capture";
import { sendProfileEmailForConversation } from "@/lib/chatbot/learning/digest";
import type { ChatbotChatMessage } from "@/lib/chatbot/openai";
import {
  hasExplicitBookingIntent,
  type ChatbotToolContext,
} from "@/lib/chatbot/tools";
import { createTurnStream } from "@/lib/chatbot/turn-stream";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The server holds the authoritative transcript (chatbot_conversations.messages,
 * upserted whole per turn — see spec). The browser only ever sends the ONE new
 * user turn, not the full history back and forth: that keeps every historical
 * `ts` stable (a full-resend contract would force re-timestamping on every
 * turn) and keeps the request small regardless of how long the chat runs.
 */
const chatRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(200),
  message: z.string().trim().min(1).max(CHATBOT_INPUT_LIMITS.maxMessageChars),
  pageUrl: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Two OpenAI calls per turn (30s + 20s ceilings) plus a tool round that can
 * make its own HTTP call. Declared explicitly: on the platform default a
 * calendar-opening turn gets cut mid-stream, which truncates the reply AND
 * skips `after()`, losing the visitor's message entirely.
 */
export const maxDuration = 90;

export async function POST(request: Request) {
  const config = await loadChatbotConfig();
  if (!config.enabled) {
    return Response.json(
      { message: "Chat is not available." },
      { status: 404 },
    );
  }

  const ip = requestIp(request.headers);
  const allowed = await checkPublicRateLimit("chatbot_chat", { ip });
  if (!allowed) {
    return Response.json(
      { message: TOO_MANY_REQUESTS_MESSAGE },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid chat request." },
      { status: 400 },
    );
  }
  const { sessionId, message, pageUrl } = parsed.data;

  if (!(await isUnderChatbotDailyCap())) {
    return Response.json(
      { message: "Chat is temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  const client = createAdminClient();

  // Only a request that would CREATE a conversation row spends this budget —
  // an existing session's turns are already covered by the per-minute chat
  // limit above. Kept outside the global 2000/day cap check: that cap is the
  // outer valve for total volume; this one stops a single IP from tripping
  // it alone by spinning up new conversations.
  const { data: existingConversation } = await client
    .from("chatbot_conversations")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!existingConversation) {
    const allowedNewConversation = await checkPublicRateLimit(
      "chatbot_new_conversation",
      { ip },
    );
    if (!allowedNewConversation) {
      return Response.json(
        { message: TOO_MANY_REQUESTS_MESSAGE },
        { status: 429 },
      );
    }
  }

  const visitorId =
    (await cookies()).get(VP_CHAT_VISITOR_COOKIE_NAME)?.value ?? null;
  const visitorHash = visitorId ? hashVisitorId(visitorId) : null;

  let conversation;
  try {
    conversation = await loadOrCreateConversation(
      {
        sessionId,
        pageUrl: pageUrl ?? null,
        userAgent: request.headers.get("user-agent"),
        visitorHash,
      },
      { client },
    );
  } catch (error) {
    console.error("chatbot: could not load conversation", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return Response.json(
      { message: "Could not start the chat." },
      { status: 500 },
    );
  }

  const priorMessages = toChatbotMessages(conversation.messages);
  const userMessage: ChatbotMessage = {
    role: "user",
    content: message,
    ts: new Date().toISOString(),
  };
  const historyForModel = [...priorMessages, userMessage];

  const budget = checkChatbotInputBudget(historyForModel);
  if (!budget.ok) {
    return Response.json(
      {
        message:
          "This conversation has gotten too long to continue here — try starting a new chat.",
      },
      { status: 400 },
    );
  }

  const extracted = extractLead(message);
  const priorEmail = conversation.captured_email;
  const priorPhone = conversation.captured_phone;
  // Mutable through the turn: capture_contact can add contact details
  // mid-turn, and both the booking URL prefill and the post-turn lead
  // handling below must see the value the tool just recorded, not the
  // snapshot taken before the model ran.
  const captured = {
    name: conversation.captured_name ?? extracted.name,
    email: priorEmail ?? extracted.email,
    phone: priorPhone ?? extracted.phone,
  };

  const userTurnCount = historyForModel.filter((m) => m.role === "user").length;
  const promptInput: ChatbotPromptInput = {
    personaName: config.personaName,
    knowledgeBase: config.knowledgeBase,
    userTurnCount,
    capturedName: captured.name,
    capturedEmail: captured.email,
    capturedPhone: captured.phone,
    prospectSummary: prospectSummaryFrom(conversation.prospect_profile),
    hasSeenCalendar: priorMessages.some((m) => m.kind === "calendar"),
  };

  const modelMessages: ChatbotChatMessage[] = [
    { role: "system", content: buildChatbotSystemPrompt(promptInput) },
    ...trimToBudget(historyForModel).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // Everything the turn produced, assembled during streaming and persisted by
  // after() once the response has been fully sent.
  const sink: { messages: ChatbotMessage[] } = { messages: [] };

  const toolContext: ChatbotToolContext = {
    conversationId: conversation.id,
    personaName: config.personaName,
    capturedName: captured.name,
    capturedEmail: captured.email,
    capturedPhone: captured.phone,
    transcript: historyForModel,
    embedDomain: siteHostname(),
    firstPartyEmail: priorEmail,
    // failClosed, and it has to be explicit: checkPublicRateLimit swallows
    // its own errors and returns true, so a plain try/catch here would never
    // fire and this would silently uncap outbound mail during any Supabase
    // blip. An unbounded mailer is worse than a missed resource email.
    checkEmailBudget: (email: string) =>
      checkPublicRateLimit(
        "chatbot_resource_email",
        { ip, email },
        { failClosed: true },
      ),
    config,
    client,
  };

  // Synchronous by construction: every failure mode (OpenAI down, a tool
  // throwing) happens once the stream is already being read, and is handled
  // inside it as a spoken fallback rather than an HTTP error.
  // The one behaviour v2 exists for is too important to leave to the model's
  // judgement: gpt-4o-mini answers "how do I book a call?" by writing "I'll
  // open the calendar for you!" and then not opening it. When the visitor has
  // asked plainly and no calendar is open yet, require the call instead of
  // requesting it.
  const forceTool =
    !promptInput.hasSeenCalendar && hasExplicitBookingIntent(message)
      ? "show_booking_calendar"
      : undefined;

  const stream = createTurnStream({
    config,
    modelMessages,
    sink,
    captured,
    toolContext,
    forceTool,
  });

  after(async () => {
    // Deliberately NOT gated on sink.messages being non-empty: a turn that
    // produced no assistant message still contains the visitor's message,
    // and dropping it would lose both the turn and any contact details it
    // carried. createTurnStream also guarantees at least a spoken fallback.
    const newMessages = [...historyForModel, ...sink.messages];

    try {
      await persistConversationTurn(
        conversation,
        {
          messages: newMessages,
          capturedName: captured.name,
          capturedEmail: captured.email,
          capturedPhone: captured.phone,
          pageUrl: pageUrl ?? null,
          visitorHash,
        },
        { client },
      );
    } catch (error) {
      console.error("chatbot: could not persist conversation turn", {
        conversationId: conversation.id,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }

    // Recomputed here, not before the model call: capture_contact may have
    // recorded the first email of the conversation during this very turn.
    const isNewCapture =
      !priorEmail && !priorPhone && Boolean(captured.email || captured.phone);
    if (!isNewCapture) return;

    // A capture detected in free text (or by the capture_contact tool) must
    // spend the same chatbot_lead budget the dedicated /api/chatbot/lead
    // route enforces — otherwise the much looser 60/min chat limit lets a
    // flood of chat turns create CRM leads at 60x the intended rate. A
    // rejection here only skips lead creation and the profile email; the turn
    // itself is already persisted above and is never affected.
    const leadAllowed = await checkPublicRateLimit("chatbot_lead", {
      ip,
      email: captured.email,
    });

    if (!leadAllowed) {
      console.warn("chatbot: lead capture rate limited", {
        conversationId: conversation.id,
      });
      return;
    }

    await handleChatbotLeadCaptured(
      {
        conversationId: conversation.id,
        sessionId,
        name: captured.name,
        email: captured.email,
        phone: captured.phone,
        pageUrl: pageUrl ?? null,
      },
      { client },
    );

    // Fire the profile email the moment we have something to say, rather
    // than waiting for the every-10-minute digest cron — see spec wiring
    // item 5a. Already inside `after()`, so this never delays the
    // response; sendProfileEmailForConversation is fail-soft end to end.
    try {
      await sendProfileEmailForConversation(conversation.id, {}, { client });
    } catch (error) {
      console.warn("chatbot: immediate profile email failed", {
        conversationId: conversation.id,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Aggregate-chars trim only — checkChatbotInputBudget already rejected the
// request outright if it exceeded the hard ceiling. This is a second, softer
// pass that keeps the most recent turns when a long-but-under-the-limit
// history would otherwise push the OpenAI request needlessly large.
function trimToBudget(messages: ChatbotMessage[]): ChatbotMessage[] {
  let total = 0;
  const kept: ChatbotMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    total += messages[i].content.length;
    if (total > CHATBOT_INPUT_LIMITS.maxAggregateChars && kept.length > 0)
      break;
    kept.unshift(messages[i]);
  }
  return kept;
}

/** Calendly requires the embedding page's domain on an inline embed. */
function siteHostname(): string | null {
  try {
    return new URL(publicConfig.siteUrl).hostname;
  } catch {
    return null;
  }
}

function hashVisitorId(visitorId: string): string {
  return createHash("sha256").update(visitorId).digest("hex");
}
