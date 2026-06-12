import {
  PAGE_BUILDER_AI_MESSAGE_MAX_CHARS,
  pageBuilderAiChatResponseSchema,
  type PageBuilderAiChatRequest,
  type PageBuilderAiChatResponse,
} from "@/lib/page-builder/ai-chat";
import { generateWithCopyRepair } from "@/lib/page-builder/ai-chat-copy-repair";
import { normalizePageBuilderAiChatResponseForIntent } from "@/lib/page-builder/ai-chat-intent-fallback";
import {
  buildPageBuilderAiToolDefinitions,
  pageBuilderAiSystemPrompt,
} from "@/lib/page-builder/ai-chat-prompt";

export type ModelSpec = {
  provider: "openai" | "gemini";
  model: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  // "copy" appends COPY_QUALITY_ADDENDUM to the system prompt (Gemini path
  // only — the OpenAI path builds its instructions inside the service).
  promptVariant?: "copy";
};

// Tone/style extras layered on top of the enforced gate rules, which now ship
// inside pageBuilderAiSystemPrompt itself (see copy-standards.ts). The #copy
// variant keeps these extras testable against the base prompt.
export const COPY_QUALITY_ADDENDUM = [
  "Tone rules:",
  "- Lead with concrete outcomes a US office manager cares about: time saved, happier staff, no mess, predictable cost.",
  "- Vary sentence length. Avoid exclamation marks.",
  "- After your tool calls, ALWAYS include a brief 1-2 sentence chat message summarizing what you changed.",
].join("\n");

export type CallMetrics = {
  ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
  rawPayload: unknown;
};

export type ChatCallResult = {
  response: PageBuilderAiChatResponse | null;
  schemaValid: boolean;
  metrics: CallMetrics;
  repaired?: boolean;
  error?: string;
};

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";

export function parseModelSpecs(raw: string): ModelSpec[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [withoutVariant, variant] = entry.split("#");
      const [providerAndModel, effort] = withoutVariant!.split("@");
      const [provider, ...modelParts] = providerAndModel!.split(":");
      if (
        (provider !== "openai" && provider !== "gemini") ||
        modelParts.length === 0 ||
        (variant !== undefined && variant !== "copy")
      ) {
        throw new Error(
          `Invalid model spec "${entry}". Use provider:model[@effort][#copy], e.g. gemini:gemini-3.1-flash-lite#copy`,
        );
      }
      return {
        provider,
        model: modelParts.join(":"),
        reasoningEffort: effort as ModelSpec["reasoningEffort"],
        promptVariant: variant as ModelSpec["promptVariant"],
      };
    });
}

export function specLabel(spec: ModelSpec) {
  return `${spec.provider}:${spec.model}${
    spec.reasoningEffort ? `@${spec.reasoningEffort}` : ""
  }${spec.promptVariant ? `#${spec.promptVariant}` : ""}`;
}

// Wraps fetch to time the call and capture the raw payload/usage without
// disturbing the consumer, which reads the body as text. Accumulates across
// calls so repair round-trips report combined latency and tokens.
function timedFetch(metrics: CallMetrics) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const start = performance.now();
    const response = await fetch(input, init);
    const text = await response.text();
    metrics.ms += performance.now() - start;
    try {
      const payload = JSON.parse(text) as Record<string, unknown>;
      metrics.rawPayload = payload;
      const usage = payload.usage as Record<string, unknown> | undefined;
      const inputTokens =
        numberOrNull(usage?.input_tokens) ?? numberOrNull(usage?.prompt_tokens);
      const outputTokens =
        numberOrNull(usage?.output_tokens) ??
        numberOrNull(usage?.completion_tokens);
      if (inputTokens !== null) {
        metrics.inputTokens = (metrics.inputTokens ?? 0) + inputTokens;
      }
      if (outputTokens !== null) {
        metrics.outputTokens = (metrics.outputTokens ?? 0) + outputTokens;
      }
    } catch {
      metrics.rawPayload = text;
    }
    return new Response(text, { status: response.status });
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function emptyMetrics(): CallMetrics {
  return { ms: 0, inputTokens: null, outputTokens: null, rawPayload: null };
}

export async function runChatCall(
  spec: ModelSpec,
  request: PageBuilderAiChatRequest,
): Promise<ChatCallResult> {
  const metrics = emptyMetrics();
  try {
    if (spec.provider === "openai") {
      // The service runs the copy-repair loop internally.
      const response = await runOpenAiChat(spec, request, metrics);
      return { response, schemaValid: true, metrics };
    }
    const { response, repaired } = await runGeminiChat(spec, request, metrics);
    return { response, schemaValid: true, metrics, repaired };
  } catch (error) {
    return {
      response: null,
      schemaValid: false,
      metrics,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runOpenAiChat(
  spec: ModelSpec,
  request: PageBuilderAiChatRequest,
  metrics: CallMetrics,
) {
  const { generateOpenAiPageBuilderChatResponse } =
    await import("@/lib/services/openai-page-builder-chat");
  return generateOpenAiPageBuilderChatResponse(request, {
    model: spec.model,
    reasoningEffort: spec.reasoningEffort,
    fetchFn: timedFetch(metrics),
  });
}

async function runGeminiChat(
  spec: ModelSpec,
  request: PageBuilderAiChatRequest,
  metrics: CallMetrics,
): Promise<{ response: PageBuilderAiChatResponse; repaired: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const { response, repaired } = await generateWithCopyRepair(
    request,
    (attempt) => rawGeminiChat(spec, attempt, metrics, apiKey),
  );
  return {
    response: normalizePageBuilderAiChatResponseForIntent(request, response),
    repaired,
  };
}

async function rawGeminiChat(
  spec: ModelSpec,
  request: PageBuilderAiChatRequest,
  metrics: CallMetrics,
  apiKey: string,
): Promise<PageBuilderAiChatResponse> {
  const latestUserMessage = [...request.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;
  const systemPrompt =
    pageBuilderAiSystemPrompt(request.context, latestUserMessage) +
    (spec.promptVariant === "copy" ? `\n\n${COPY_QUALITY_ADDENDUM}` : "");
  const body = {
    model: spec.model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...request.messages.map(({ role, content }) => ({ role, content })),
    ],
    tools: buildPageBuilderAiToolDefinitions(request.context).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: looseJsonSchema(tool.parameters),
      },
    })),
    tool_choice: "auto",
    ...(spec.reasoningEffort ? { reasoning_effort: spec.reasoningEffort } : {}),
  };

  const fetchFn = timedFetch(metrics);
  const response = await fetchFn(`${GEMINI_OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = metrics.rawPayload;
  if (!response.ok) {
    throw new Error(`Gemini rejected the request: ${snippet(payload)}`);
  }

  const message = firstChoiceMessage(payload);
  const normalized = pageBuilderAiChatResponseSchema.safeParse({
    message: clampMessage(stringContent(message?.content)),
    toolCalls: extractToolCalls(message?.tool_calls),
  });
  if (!normalized.success) {
    throw new Error(
      `Gemini returned an invalid chat response: ${
        normalized.error.issues[0]?.message ?? "Invalid response"
      }`,
    );
  }
  return normalized.data;
}

export type ProposalCapture = {
  instructions: string;
  input: string;
  schema: unknown;
};

export type ProposalCallResult = {
  proposal: unknown;
  metrics: CallMetrics;
  capture?: ProposalCapture;
  error?: string;
};

export async function runOpenAiProposal(
  spec: ModelSpec,
  page: Parameters<
    typeof import("@/lib/services/openai-seo-agent").generateOpenAiSeoProposalFromSources
  >[0]["page"],
  sourceBundle: import("@/lib/services/openai-seo-agent").SeoAgentSourceBundle,
): Promise<ProposalCallResult> {
  const metrics = emptyMetrics();
  let capture: ProposalCapture | undefined;
  const { generateOpenAiSeoProposalFromSources } =
    await import("@/lib/services/openai-seo-agent");
  const inner = timedFetch(metrics);
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      instructions: string;
      input: string;
      text: { format: { schema: unknown } };
    };
    capture = {
      instructions: body.instructions,
      input: body.input,
      schema: body.text.format.schema,
    };
    return inner(input, init);
  };
  try {
    const proposal = await generateOpenAiSeoProposalFromSources(
      {
        page,
        sourceBundle,
        model: spec.model,
        reasoningEffort: spec.reasoningEffort,
      },
      { fetchFn },
    );
    return { proposal, metrics, capture };
  } catch (error) {
    return {
      proposal: null,
      metrics,
      capture,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runGeminiProposal(
  spec: ModelSpec,
  capture: ProposalCapture,
): Promise<ProposalCallResult> {
  const metrics = emptyMetrics();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey)
    return { proposal: null, metrics, error: "GEMINI_API_KEY is not set." };

  try {
    const fetchFn = timedFetch(metrics);
    const response = await fetchFn(`${GEMINI_OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: "system", content: capture.instructions },
          { role: "user", content: capture.input },
        ],
        ...(spec.reasoningEffort
          ? { reasoning_effort: spec.reasoningEffort }
          : {}),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "seo_page_proposal",
            strict: true,
            schema: looseJsonSchema(capture.schema),
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Gemini rejected the request: ${snippet(metrics.rawPayload)}`,
      );
    }
    const message = firstChoiceMessage(metrics.rawPayload);
    const proposal = JSON.parse(stringContent(message?.content)) as unknown;
    return { proposal, metrics };
  } catch (error) {
    return {
      proposal: null,
      metrics,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listGeminiFlashModels(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return [];
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`,
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  return (payload.models ?? [])
    .filter(
      (model) =>
        model.name.includes("flash") &&
        (model.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((model) => model.name.replace(/^models\//, ""));
}

// Gemini's OpenAI-compat layer supports a narrower JSON-schema subset than
// OpenAI strict mode; drop length/pattern constraints and flatten nullable
// type arrays so tool and response schemas are accepted.
const unsupportedConstraintKeys = new Set([
  "maxItems",
  "minItems",
  "maxLength",
  "minLength",
  "maximum",
  "minimum",
  "pattern",
]);

function looseJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(looseJsonSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const type = source.type;
  if (Array.isArray(type) && type.includes("null")) {
    const nonNullTypes = type.filter((item) => item !== "null");
    if (nonNullTypes.length === 1) {
      const nonNullSchema: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(source)) {
        if (key === "type" || unsupportedConstraintKeys.has(key)) continue;
        nonNullSchema[key] = looseJsonSchema(child);
      }
      nonNullSchema.type = nonNullTypes[0];
      return { anyOf: [nonNullSchema, { type: "null" }] };
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (unsupportedConstraintKeys.has(key)) continue;
    result[key] = looseJsonSchema(child);
  }
  return result;
}

function firstChoiceMessage(payload: unknown) {
  if (typeof payload !== "object" || !payload || !("choices" in payload)) {
    return null;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const choice = choices[0];
  if (typeof choice !== "object" || !choice || !("message" in choice)) {
    return null;
  }
  return (choice as { message: { content?: unknown; tool_calls?: unknown } })
    .message;
}

function stringContent(content: unknown): string {
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

function extractToolCalls(toolCalls: unknown) {
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
        input: JSON.parse(call.function.arguments) as unknown,
      },
    ];
  });
}

function clampMessage(text: string) {
  return text.length > PAGE_BUILDER_AI_MESSAGE_MAX_CHARS
    ? text.slice(0, PAGE_BUILDER_AI_MESSAGE_MAX_CHARS).trimEnd()
    : text;
}

function snippet(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return (text ?? "").slice(0, 300);
}
