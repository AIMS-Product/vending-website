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
import { extractLead } from "@/lib/chatbot/extract-lead";
import { handleChatbotLeadCaptured } from "@/lib/chatbot/lead-capture";
import { ChatbotOpenAiError, streamChatbotReply } from "@/lib/chatbot/openai";
import { stripChatbotFormatting } from "@/lib/chatbot/strip-formatting";
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
  const capturedEmail = priorEmail ?? extracted.email;
  const capturedPhone = priorPhone ?? extracted.phone;
  const capturedName = conversation.captured_name ?? extracted.name;
  const isNewCapture =
    !priorEmail && !priorPhone && Boolean(capturedEmail || capturedPhone);

  const userTurnCount = historyForModel.filter((m) => m.role === "user").length;
  const promptInput: ChatbotPromptInput = {
    personaName: config.personaName,
    knowledgeBase: config.knowledgeBase,
    userTurnCount,
    capturedName,
    capturedEmail,
    capturedPhone,
    prospectSummary: prospectSummaryFrom(conversation.prospect_profile),
  };
  const systemPrompt = buildChatbotSystemPrompt(promptInput);

  let upstream: Response;
  try {
    upstream = await streamChatbotReply({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...trimToBudget(historyForModel),
      ],
    });
  } catch (error) {
    console.error("chatbot: OpenAI request failed", {
      error:
        error instanceof ChatbotOpenAiError ? error.message : "unknown error",
    });
    return Response.json(
      { message: "The chat assistant is unavailable right now." },
      { status: 502 },
    );
  }

  if (!upstream.body) {
    return Response.json(
      { message: "The chat assistant returned no reply." },
      { status: 502 },
    );
  }

  const sink = { text: "" };
  const clientStream = streamAssistantText(upstream.body, sink);

  after(async () => {
    const finalText = stripChatbotFormatting(sink.text);
    if (!finalText) return;

    const assistantMessage: ChatbotMessage = {
      role: "assistant",
      content: finalText,
      ts: new Date().toISOString(),
    };
    const newMessages = [...historyForModel, assistantMessage];

    try {
      await persistConversationTurn(
        conversation,
        {
          messages: newMessages,
          capturedName,
          capturedEmail,
          capturedPhone,
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

    if (isNewCapture) {
      await handleChatbotLeadCaptured(
        {
          conversationId: conversation.id,
          sessionId,
          name: capturedName,
          email: capturedEmail,
          phone: capturedPhone,
          pageUrl: pageUrl ?? null,
        },
        { client },
      );
    }
  });

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
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

/** Parses OpenAI's SSE chat-completion stream into a plain UTF-8 text stream, accumulating the full reply into `sink`. */
function streamAssistantText(
  upstream: ReadableStream<Uint8Array>,
  sink: { text: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        console.warn("chatbot: OpenAI stream read failed", {
          error: error instanceof Error ? error.message : "unknown error",
        });
        controller.close();
        return;
      }

      if (result.done) {
        controller.close();
        return;
      }

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        const content = parseDeltaContent(payload);
        if (content) {
          sink.text += content;
          controller.enqueue(encoder.encode(content));
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

function parseDeltaContent(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return parsed.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

function hashVisitorId(visitorId: string): string {
  return createHash("sha256").update(visitorId).digest("hex");
}
