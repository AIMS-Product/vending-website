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
import {
  ChatbotOpenAiError,
  streamChatbotReply,
  type ChatbotChatMessage,
  type ChatbotToolCall,
} from "@/lib/chatbot/openai";
import { stripChatbotFormatting } from "@/lib/chatbot/strip-formatting";
import {
  CHATBOT_TOOL_DEFINITIONS,
  runChatbotTool,
  type ChatbotToolContext,
} from "@/lib/chatbot/tools";
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
 * Wire format to the widget: newline-delimited JSON, one frame per line.
 *
 * v1 streamed raw text, which had no room for anything but text. v2 has to
 * interleave an inline calendar and resource cards with prose in one turn, so
 * the stream carries frames instead:
 *
 * - `text`   append to the in-flight assistant bubble
 * - `flush`  commit the in-flight bubble as a finished message
 * - `msg`    a complete rich message (calendar, resource card)
 * - `status` transient UI state, e.g. "finding times" while a tool runs
 *
 * Frames are emitted in transcript order, so a client that renders them in
 * arrival order always matches what the server persisted.
 */
type ChatStreamFrame =
  | { t: "text"; v: string }
  | { t: "flush" }
  | { t: "status"; v: "finding_times" }
  | {
      t: "msg";
      content: string;
      kind: NonNullable<ChatbotMessage["kind"]>;
      data: ChatbotMessage["data"];
    };

/** One tool round per turn: call 1 may use tools, call 2 must produce prose. */
const MAX_MODEL_CALLS_PER_TURN = 2;

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
    config,
    client,
  };

  // Synchronous by construction: every failure mode (OpenAI down, a tool
  // throwing) happens once the stream is already being read, and is handled
  // inside it as a spoken fallback rather than an HTTP error.
  const stream = createTurnStream({
    config,
    modelMessages,
    sink,
    captured,
    toolContext,
  });

  after(async () => {
    if (sink.messages.length === 0) return;

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

type TurnStreamInput = {
  config: { model: string };
  modelMessages: ChatbotChatMessage[];
  sink: { messages: ChatbotMessage[] };
  captured: { name: string | null; email: string | null; phone: string | null };
  toolContext: ChatbotToolContext;
};

/**
 * Drives the whole turn: up to two model calls with one tool round between
 * them, emitting NDJSON frames as it goes and collecting the messages to
 * persist into `sink`.
 *
 * Tools are offered on the FIRST call only. That is what bounds the turn: the
 * second call has no tools available, so it can only answer in prose and the
 * loop cannot run away. It also means a turn never ends on an unanswered tool
 * call, which would leave the visitor staring at nothing.
 */
function createTurnStream(input: TurnStreamInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (frame: ChatStreamFrame) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      };

      try {
        for (let call = 0; call < MAX_MODEL_CALLS_PER_TURN; call += 1) {
          const upstream = await streamChatbotReply({
            model: input.config.model,
            messages: input.modelMessages,
            tools: call === 0 ? [...CHATBOT_TOOL_DEFINITIONS] : undefined,
          });

          if (!upstream.body) {
            throw new ChatbotOpenAiError("OpenAI returned no reply body.");
          }

          const { text, toolCalls } = await pumpCompletion(
            upstream.body,
            (delta) => emit({ t: "text", v: delta }),
          );

          const finalText = stripChatbotFormatting(text);
          if (finalText) {
            emit({ t: "flush" });
            input.sink.messages.push({
              role: "assistant",
              content: finalText,
              ts: new Date().toISOString(),
            });
          }

          if (toolCalls.length === 0) break;

          // The assistant's tool-call turn has to go back to the model
          // verbatim, or the follow-up `tool` messages have nothing to
          // answer and OpenAI rejects the second call outright.
          input.modelMessages.push({
            role: "assistant",
            content: finalText || null,
            tool_calls: toolCalls,
          });

          await runToolRound(toolCalls, input, emit);
        }
      } catch (error) {
        console.error("chatbot: turn failed", {
          error:
            error instanceof ChatbotOpenAiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "unknown error",
        });
        // Mid-stream failures cannot become an HTTP error code — the status
        // line is long gone. Say something human instead of truncating, and
        // persist it so the transcript matches what the visitor saw.
        if (input.sink.messages.length === 0) {
          const fallback =
            "Sorry, something glitched on my end. Mind sending that again?";
          emit({ t: "text", v: fallback });
          emit({ t: "flush" });
          input.sink.messages.push({
            role: "assistant",
            content: fallback,
            ts: new Date().toISOString(),
          });
        }
      } finally {
        controller.close();
      }
    },
  });
}

async function runToolRound(
  toolCalls: ChatbotToolCall[],
  input: TurnStreamInput,
  emit: (frame: ChatStreamFrame) => void,
): Promise<void> {
  for (const toolCall of toolCalls) {
    if (toolCall.function.name === "show_booking_calendar") {
      emit({ t: "status", v: "finding_times" });
    }

    const outcome = await runChatbotTool(
      toolCall.function.name,
      toolCall.function.arguments,
      input.toolContext,
    );

    input.modelMessages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: outcome.result,
    });

    if (outcome.capture) {
      // First value wins, exactly like the free-text path: a later turn never
      // overwrites contact details already on file.
      const { name, email, phone } = outcome.capture;
      if (name && !input.captured.name) input.captured.name = name;
      if (email && !input.captured.email) input.captured.email = email;
      if (phone && !input.captured.phone) input.captured.phone = phone;
      input.toolContext.capturedName = input.captured.name;
      input.toolContext.capturedEmail = input.captured.email;
      input.toolContext.capturedPhone = input.captured.phone;
    }

    if (outcome.message?.kind) {
      emit({
        t: "msg",
        content: outcome.message.content,
        kind: outcome.message.kind,
        data: outcome.message.data,
      });
      input.sink.messages.push(outcome.message);
      // Keeps the per-conversation caps (one calendar, two resource emails)
      // honest when a single turn calls the same tool twice.
      input.toolContext.transcript = [
        ...input.toolContext.transcript,
        outcome.message,
      ];
    }
  }
}

type PumpedCompletion = { text: string; toolCalls: ChatbotToolCall[] };

/**
 * Parses one OpenAI SSE chat-completion stream, forwarding content deltas to
 * `onText` and assembling tool calls (which arrive fragmented across deltas,
 * keyed by index) into whole calls.
 */
async function pumpCompletion(
  upstream: ReadableStream<Uint8Array>,
  onText: (delta: string) => void,
): Promise<PumpedCompletion> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const partialToolCalls = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        const delta = parseDelta(payload);
        if (!delta) continue;

        if (delta.content) {
          text += delta.content;
          onText(delta.content);
        }

        for (const call of delta.toolCalls ?? []) {
          const existing = partialToolCalls.get(call.index) ?? {
            id: "",
            name: "",
            arguments: "",
          };
          partialToolCalls.set(call.index, {
            id: call.id || existing.id,
            name: call.name || existing.name,
            arguments: existing.arguments + (call.arguments ?? ""),
          });
        }
      }
    }
  } catch (error) {
    // A dropped upstream mid-stream keeps whatever already arrived rather
    // than discarding a partial reply the visitor has already read.
    console.warn("chatbot: OpenAI stream read failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  } finally {
    reader.cancel().catch(() => {});
  }

  const toolCalls: ChatbotToolCall[] = Array.from(partialToolCalls.entries())
    .sort(([a], [b]) => a - b)
    .filter(([, call]) => call.id && call.name)
    .map(([, call]) => ({
      id: call.id,
      type: "function" as const,
      function: { name: call.name, arguments: call.arguments },
    }));

  return { text, toolCalls };
}

type ParsedDelta = {
  content?: string;
  toolCalls?: Array<{
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
  }>;
};

function parseDelta(payload: string): ParsedDelta | null {
  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{
        delta?: {
          content?: string;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return null;

    return {
      content: delta.content ?? undefined,
      toolCalls: delta.tool_calls?.map((call, fallbackIndex) => ({
        index: call.index ?? fallbackIndex,
        id: call.id,
        name: call.function?.name,
        arguments: call.function?.arguments,
      })),
    };
  } catch {
    return null;
  }
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
