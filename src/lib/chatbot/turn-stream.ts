import "server-only";

import {
  ChatbotOpenAiError,
  streamChatbotReply,
  type ChatbotChatMessage,
  type ChatbotToolCall,
} from "@/lib/chatbot/openai";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { stripChatbotFormatting } from "@/lib/chatbot/strip-formatting";
import {
  CHATBOT_TOOL_DEFINITIONS,
  runChatbotTool,
  type ChatbotToolContext,
} from "@/lib/chatbot/tools";

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
export type ChatStreamFrame =
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

const SECOND_CALL_TIMEOUT_MS = 20_000;

export type TurnStreamInput = {
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
export function createTurnStream(
  input: TurnStreamInput,
): ReadableStream<Uint8Array> {
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
            // The follow-up call is a short confirmation sentence, and both
            // calls plus the tool round have to fit inside the route's
            // maxDuration. It gets a tighter budget than the first.
            timeoutMs: call === 0 ? undefined : SECOND_CALL_TIMEOUT_MS,
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
      } finally {
        // Outside the catch on purpose. A turn can finish with nothing to
        // show WITHOUT throwing: the second model call can return only
        // whitespace, and pumpCompletion swallows a mid-stream read failure
        // and returns empty text. Both used to end here silently, which the
        // widget surfaced as an error and which skipped persistence of the
        // visitor's own message. Anything that reaches this point with an
        // empty turn gets a spoken fallback instead.
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

export type PumpedCompletion = { text: string; toolCalls: ChatbotToolCall[] };

/**
 * Parses one OpenAI SSE chat-completion stream, forwarding content deltas to
 * `onText` and assembling tool calls (which arrive fragmented across deltas,
 * keyed by index) into whole calls.
 */
export async function pumpCompletion(
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
