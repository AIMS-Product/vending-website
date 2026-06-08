import "server-only";

import { config } from "@/lib/config";
import {
  buildPageBuilderAiToolDefinitions,
  normalizePageBuilderAiChatResponseForIntent,
  pageBuilderAiChatResponseSchema,
  pageBuilderAiSystemPrompt,
  type PageBuilderAiChatRequest,
  type PageBuilderAiChatResponse,
} from "@/lib/page-builder/ai-chat";
import { toCerebrasJsonSchema } from "@/lib/page-builder/cerebras-json-schema";
import type { SeoAgentProvider } from "@/lib/page-builder/seo-agent-provider";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type OpenAiPageBuilderChatOptions = {
  apiKey?: string;
  cerebrasApiKey?: string;
  fetchFn?: FetchLike;
  provider?: SeoAgentProvider;
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
const CEREBRAS_CHAT_COMPLETIONS_URL =
  "https://api.cerebras.ai/v1/chat/completions";

export async function generateOpenAiPageBuilderChatResponse(
  request: PageBuilderAiChatRequest,
  options: OpenAiPageBuilderChatOptions = {},
): Promise<PageBuilderAiChatResponse> {
  const provider = options.provider ?? "openai";
  const apiKey =
    provider === "cerebras"
      ? options.cerebrasApiKey !== undefined
        ? options.cerebrasApiKey.trim()
        : config.CEREBRAS_API_KEY
      : options.apiKey !== undefined
        ? options.apiKey.trim()
        : config.OPENAI_API_KEY;
  if (!apiKey) {
    throw new PageBuilderAiConfigurationError(
      provider === "cerebras"
        ? "Cerebras API key is not configured for the page builder assistant."
        : "OpenAI API key is not configured for the page builder assistant.",
    );
  }

  if (provider === "cerebras") {
    return generateCerebrasPageBuilderChatResponse(request, {
      apiKey,
      fetchFn: options.fetchFn ?? fetch,
      model: options.model ?? config.CEREBRAS_SEO_MODEL,
      reasoningEffort:
        options.reasoningEffort ?? config.OPENAI_SEO_REASONING_EFFORT,
    });
  }

  const response = await (options.fetchFn ?? fetch)(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? config.OPENAI_SEO_MODEL,
      instructions: pageBuilderAiSystemPrompt(
        request.context,
        latestUserMessage(request),
      ),
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

  return normalizePageBuilderAiChatResponseForIntent(request, normalized.data);
}

async function generateCerebrasPageBuilderChatResponse(
  request: PageBuilderAiChatRequest,
  options: {
    apiKey: string;
    fetchFn: FetchLike;
    model: string;
    reasoningEffort: OpenAiPageBuilderChatOptions["reasoningEffort"];
  },
): Promise<PageBuilderAiChatResponse> {
  const response = await options.fetchFn(CEREBRAS_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        {
          role: "system",
          content: pageBuilderAiSystemPrompt(
            request.context,
            latestUserMessage(request),
          ),
        },
        ...request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      tools: buildPageBuilderChatCompletionTools(request.context),
      tool_choice: "auto",
      parallel_tool_calls: true,
      reasoning_effort: cerebrasReasoningEffort(
        options.reasoningEffort ?? "medium",
      ),
      max_completion_tokens: 5000,
    }),
  });

  const payload = await readProviderResponse(response, "Cerebras");
  if (!response.ok) {
    throw generationErrorFromPayload(response.status, payload, "Cerebras");
  }

  const normalized = pageBuilderAiChatResponseSchema.safeParse({
    message: extractCerebrasOutputText(payload),
    toolCalls: extractCerebrasToolCalls(payload),
  });
  if (!normalized.success) {
    throw new PageBuilderAiGenerationError(
      `Cerebras returned an invalid page-builder chat response: ${
        normalized.error.issues[0]?.message ?? "Invalid response"
      }`,
    );
  }

  return normalizePageBuilderAiChatResponseForIntent(request, normalized.data);
}

async function readOpenAiResponse(response: Response) {
  return readProviderResponse(response, "OpenAI");
}

async function readProviderResponse(response: Response, provider: string) {
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new PageBuilderAiGenerationError(
      `${provider} returned invalid JSON.`,
      {
        status: response.status,
      },
    );
  }
}

function generationErrorFromPayload(
  status: number,
  payload: unknown,
  provider = "OpenAI",
) {
  const code = errorCodeFromPayload(payload);
  const detail = code ? ` (${code})` : "";
  return new PageBuilderAiGenerationError(
    `${provider} rejected the page-builder assistant request${detail}.`,
    { status, code },
  );
}

function errorCodeFromPayload(payload: unknown) {
  if (typeof payload !== "object" || !payload) return undefined;
  if (
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "object" &&
    (payload as { error?: unknown }).error
  ) {
    const error = (payload as { error?: { code?: unknown } }).error;
    return typeof error?.code === "string" ? error.code : undefined;
  }
  if (
    "code" in payload &&
    typeof (payload as { code?: unknown }).code === "string"
  ) {
    return (payload as { code: string }).code;
  }
  return undefined;
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

function extractCerebrasOutputText(payload: unknown) {
  const message = firstCerebrasMessage(payload);
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" &&
        part &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .join("")
      .trim();
  }
  return "";
}

function extractCerebrasToolCalls(payload: unknown) {
  const message = firstCerebrasMessage(payload);
  const toolCalls = message?.tool_calls;
  if (!Array.isArray(toolCalls)) return [];

  return toolCalls.flatMap((toolCall, index) => {
    if (
      typeof toolCall !== "object" ||
      !toolCall ||
      (toolCall as { type?: unknown }).type !== "function"
    ) {
      return [];
    }
    const call = toolCall as {
      id?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    if (typeof call.function?.name !== "string") return [];
    if (typeof call.function.arguments !== "string") return [];
    return [
      {
        id: typeof call.id === "string" ? call.id : `tool_call_${index + 1}`,
        name: call.function.name,
        input: parseArguments(call.function.arguments),
      },
    ];
  });
}

function firstCerebrasMessage(payload: unknown) {
  const choices =
    typeof payload === "object" && payload && "choices" in payload
      ? (payload as { choices?: unknown }).choices
      : null;
  if (!Array.isArray(choices)) return null;
  for (const choice of choices) {
    if (
      typeof choice === "object" &&
      choice &&
      "message" in choice &&
      typeof (choice as { message?: unknown }).message === "object" &&
      (choice as { message?: unknown }).message
    ) {
      return (
        choice as {
          message: {
            content?: unknown;
            tool_calls?: unknown;
          };
        }
      ).message;
    }
  }
  return null;
}

function buildPageBuilderChatCompletionTools(
  context: PageBuilderAiChatRequest["context"],
) {
  return buildPageBuilderAiToolDefinitions(context).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      strict: tool.strict,
      parameters: toCerebrasJsonSchema(tool.parameters),
    },
  }));
}

function cerebrasReasoningEffort(
  effort: NonNullable<OpenAiPageBuilderChatOptions["reasoningEffort"]>,
) {
  if (effort === "high" || effort === "xhigh") return "high";
  if (effort === "medium") return "medium";
  return "low";
}

function latestUserMessage(request: PageBuilderAiChatRequest) {
  return [...request.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;
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
