import "server-only";

import { config } from "@/lib/config";

// Thin raw-fetch OpenAI client, matching the house pattern in
// src/lib/services/openai-page-builder-chat.ts. The `openai` npm package is
// deliberately NOT a dependency of this project — keep it that way.

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export type ChatbotToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/**
 * Deliberately one loose shape rather than a discriminated union: this object
 * is serialized straight into the OpenAI request body, and every consumer
 * here builds it field by field. A union would buy type-safety the call site
 * immediately has to cast its way out of.
 *
 * - `content` is null only on an assistant turn that is purely tool calls.
 * - `tool_calls` belongs on an assistant message; `tool_call_id` on a `tool`
 *   message answering one.
 */
export type ChatbotChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ChatbotToolCall[];
  tool_call_id?: string;
};

export type ChatbotToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export class ChatbotOpenAiError extends Error {
  status?: number;
  constructor(message: string, options?: { status?: number }) {
    super(message);
    this.name = "ChatbotOpenAiError";
    this.status = options?.status;
  }
}

type FetchLike = typeof fetch;

export type StreamChatbotReplyOptions = {
  model: string;
  messages: ChatbotChatMessage[];
  apiKey?: string;
  fetchFn?: FetchLike;
  maxOutputTokens?: number;
  /** Omitted or empty means no `tools` key in the request at all. */
  tools?: ChatbotToolDefinition[];
};

/**
 * Opens a streaming chat completion and returns the raw Response so the
 * caller (the chat API route) can pass the SSE body straight through to the
 * browser. Throws before any bytes are returned if OpenAI rejects the
 * request outright — a mid-stream OpenAI error still surfaces as SSE data
 * the caller must handle itself.
 */
const STREAM_TIMEOUT_MS = 30_000;
const EXTRACTION_TIMEOUT_MS = 15_000;

export async function streamChatbotReply(
  options: StreamChatbotReplyOptions,
): Promise<Response> {
  const apiKey = resolveApiKey(options.apiKey);

  let response: Response;
  try {
    response = await (options.fetchFn ?? fetch)(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: true,
        // Short replies by design (see build-system-prompt's FORMATTING
        // rule: 1-3 sentences per turn) — this is a ceiling, not a target.
        max_tokens: options.maxOutputTokens ?? 700,
        ...(options.tools?.length
          ? { tools: options.tools, tool_choice: "auto" }
          : {}),
      }),
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ChatbotOpenAiError(
      isTimeoutError(error)
        ? "OpenAI chat request timed out."
        : `OpenAI chat request failed: ${errorMessage(error)}.`,
    );
  }

  if (!response.ok || !response.body) {
    throw new ChatbotOpenAiError(
      `OpenAI rejected the chat request${await safeErrorDetail(response)}.`,
      { status: response.status },
    );
  }

  return response;
}

export type ExtractJsonOptions = {
  model: string;
  systemPrompt: string;
  userContent: string;
  apiKey?: string;
  fetchFn?: FetchLike;
};

/**
 * Non-streaming JSON-mode call used by extract-prospect-profile.ts. Returns
 * the parsed-but-unvalidated payload; callers must validate shape with zod
 * before trusting it (extraction is fail-soft by contract — a shape
 * mismatch here must never throw past the caller).
 */
export async function extractChatbotJson(
  options: ExtractJsonOptions,
): Promise<unknown> {
  const apiKey = resolveApiKey(options.apiKey);

  let response: Response;
  try {
    response = await (options.fetchFn ?? fetch)(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
      signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
    });
  } catch (error) {
    // Caller (extract-prospect-profile.ts) is fail-soft end to end — this
    // still throws so it logs a specific reason there instead of a raw
    // AbortError/DOMException.
    throw new ChatbotOpenAiError(
      isTimeoutError(error)
        ? "OpenAI extraction request timed out."
        : `OpenAI extraction request failed: ${errorMessage(error)}.`,
    );
  }

  const body = await response.text();
  if (!response.ok) {
    throw new ChatbotOpenAiError(
      `OpenAI rejected the extraction request (${response.status}).`,
      { status: response.status },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new ChatbotOpenAiError(
      "OpenAI returned invalid JSON for extraction.",
    );
  }

  const content = extractChatCompletionText(payload);
  if (!content) {
    throw new ChatbotOpenAiError(
      "OpenAI returned an empty extraction response.",
    );
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new ChatbotOpenAiError(
      "OpenAI extraction content was not valid JSON.",
    );
  }
}

function resolveApiKey(apiKey?: string): string {
  const resolved = (apiKey ?? config.OPENAI_API_KEY)?.trim();
  if (!resolved) {
    throw new ChatbotOpenAiError(
      "OpenAI API key is not configured for the chatbot.",
    );
  }
  return resolved;
}

function extractChatCompletionText(payload: unknown): string | null {
  if (typeof payload !== "object" || !payload) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown } | undefined)?.message;
  if (typeof message !== "object" || !message) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

// AbortSignal.timeout() rejects with a DOMException — "TimeoutError" on
// modern runtimes, "AbortError" on older ones. Either means the same thing
// here: the request took too long, not that OpenAI rejected it.
function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

async function safeErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.text();
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ? `: ${parsed.error.message}` : "";
  } catch {
    return "";
  }
}
