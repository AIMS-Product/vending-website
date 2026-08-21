import "server-only";

import { config } from "@/lib/config";

// Thin raw-fetch OpenAI client, matching the house pattern in
// src/lib/services/openai-page-builder-chat.ts. The `openai` npm package is
// deliberately NOT a dependency of this project — keep it that way.

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export type ChatbotChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
};

/**
 * Opens a streaming chat completion and returns the raw Response so the
 * caller (the chat API route) can pass the SSE body straight through to the
 * browser. Throws before any bytes are returned if OpenAI rejects the
 * request outright — a mid-stream OpenAI error still surfaces as SSE data
 * the caller must handle itself.
 */
export async function streamChatbotReply(
  options: StreamChatbotReplyOptions,
): Promise<Response> {
  const apiKey = resolveApiKey(options.apiKey);

  const response = await (options.fetchFn ?? fetch)(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      // Short replies by design (see build-system-prompt's FORMATTING rule:
      // 1-3 sentences per turn) — this is a ceiling, not a target.
      max_tokens: options.maxOutputTokens ?? 700,
    }),
  });

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

  const response = await (options.fetchFn ?? fetch)(CHAT_COMPLETIONS_URL, {
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
  });

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
    throw new ChatbotOpenAiError("OpenAI returned invalid JSON for extraction.");
  }

  const content = extractChatCompletionText(payload);
  if (!content) {
    throw new ChatbotOpenAiError("OpenAI returned an empty extraction response.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new ChatbotOpenAiError("OpenAI extraction content was not valid JSON.");
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

async function safeErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.text();
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ? `: ${parsed.error.message}` : "";
  } catch {
    return "";
  }
}
