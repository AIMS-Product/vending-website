import "server-only";

import { config } from "@/lib/config";
import {
  buildPageBuilderAiToolDefinitions,
  pageBuilderAiChatResponseSchema,
  pageBuilderAiSystemPrompt,
  type PageBuilderAiChatRequest,
  type PageBuilderAiChatResponse,
} from "@/lib/page-builder/ai-chat";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type OpenAiPageBuilderChatOptions = {
  apiKey?: string;
  fetchFn?: FetchLike;
  model?: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
};

export class PageBuilderAiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageBuilderAiConfigurationError";
  }
}

export class PageBuilderAiGenerationError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "PageBuilderAiGenerationError";
    this.status = options?.status;
    this.code = options?.code;
  }
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function generateOpenAiPageBuilderChatResponse(
  request: PageBuilderAiChatRequest,
  options: OpenAiPageBuilderChatOptions = {},
): Promise<PageBuilderAiChatResponse> {
  const apiKey =
    options.apiKey !== undefined
      ? options.apiKey.trim()
      : config.OPENAI_API_KEY;
  if (!apiKey) {
    throw new PageBuilderAiConfigurationError(
      "OpenAI API key is not configured for the page builder assistant.",
    );
  }

  const response = await (options.fetchFn ?? fetch)(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? config.OPENAI_SEO_MODEL,
      instructions: pageBuilderAiSystemPrompt(request.context),
      input: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      tools: buildPageBuilderAiToolDefinitions(request.context),
      tool_choice: "auto",
      parallel_tool_calls: true,
      reasoning: {
        effort: options.reasoningEffort ?? config.OPENAI_SEO_REASONING_EFFORT,
      },
      max_output_tokens: 5000,
      store: false,
      metadata: {
        surface: "seo-page-builder-chat",
        page_id: request.context.pageId ?? "new-page",
      },
    }),
  });

  const payload = await readOpenAiResponse(response);
  if (!response.ok) throw generationErrorFromPayload(response.status, payload);

  const normalized = pageBuilderAiChatResponseSchema.safeParse({
    message: extractOpenAiOutputText(payload),
    toolCalls: extractOpenAiFunctionCalls(payload),
  });
  if (!normalized.success) {
    throw new PageBuilderAiGenerationError(
      `OpenAI returned an invalid page-builder chat response: ${
        normalized.error.issues[0]?.message ?? "Invalid response"
      }`,
    );
  }

  return normalized.data;
}

async function readOpenAiResponse(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new PageBuilderAiGenerationError("OpenAI returned invalid JSON.", {
      status: response.status,
    });
  }
}

function generationErrorFromPayload(status: number, payload: unknown) {
  const error =
    typeof payload === "object" && payload && "error" in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : null;
  const code = error?.code;
  const detail = code ? ` (${code})` : "";
  return new PageBuilderAiGenerationError(
    `OpenAI rejected the page-builder assistant request${detail}.`,
    { status, code },
  );
}

function extractOpenAiOutputText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload &&
    "output_text" in payload &&
    typeof (payload as { output_text?: unknown }).output_text === "string"
  ) {
    return (payload as { output_text: string }).output_text;
  }

  const output =
    typeof payload === "object" && payload && "output" in payload
      ? (payload as { output?: unknown }).output
      : null;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    if (
      typeof item !== "object" ||
      !item ||
      (item as { type?: unknown }).type !== "message" ||
      !Array.isArray((item as { content?: unknown }).content)
    ) {
      continue;
    }
    for (const part of (item as { content: unknown[] }).content) {
      if (
        typeof part === "object" &&
        part &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        chunks.push((part as { text: string }).text);
      }
    }
  }

  return chunks.join("").trim();
}

function extractOpenAiFunctionCalls(payload: unknown) {
  const output =
    typeof payload === "object" && payload && "output" in payload
      ? (payload as { output?: unknown }).output
      : null;
  if (!Array.isArray(output)) return [];

  return output.flatMap((item, index) => {
    if (
      typeof item !== "object" ||
      !item ||
      (item as { type?: unknown }).type !== "function_call"
    ) {
      return [];
    }
    const call = item as {
      id?: unknown;
      call_id?: unknown;
      name?: unknown;
      arguments?: unknown;
    };
    if (typeof call.name !== "string") return [];
    if (typeof call.arguments !== "string") return [];

    return [
      {
        id:
          typeof call.call_id === "string"
            ? call.call_id
            : typeof call.id === "string"
              ? call.id
              : `tool_call_${index + 1}`,
        name: call.name,
        input: parseArguments(call.arguments),
      },
    ];
  });
}

function parseArguments(value: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new PageBuilderAiGenerationError(
      "OpenAI returned a tool call with invalid JSON arguments.",
    );
  }
}
