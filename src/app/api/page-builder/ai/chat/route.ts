import { pageBuilderAiChatRequestSchema } from "@/lib/page-builder/ai-chat";
import type { SeoAgentProvider } from "@/lib/page-builder/seo-agent-provider";
import {
  PageBuilderAiConfigurationError,
  PageBuilderAiGenerationError,
  generateOpenAiPageBuilderChatResponse,
} from "@/lib/services/openai-page-builder-chat";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const providerValues = new Set<SeoAgentProvider>(["openai", "cerebras"]);

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (!checkRateLimit(admin.user.id)) {
    return Response.json(
      { message: "Too many AI requests. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const provider = parseProvider(body);
  const parsed = pageBuilderAiChatRequestSchema.safeParse(
    bodyWithoutProvider(body),
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid AI request." },
      { status: 400 },
    );
  }

  try {
    const response = await generateOpenAiPageBuilderChatResponse(parsed.data, {
      provider,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof PageBuilderAiConfigurationError) {
      return Response.json(
        { message: "OpenAI is not configured for the page builder assistant." },
        { status: 503 },
      );
    }
    if (error instanceof PageBuilderAiGenerationError) {
      const status = error.status === 429 ? 429 : 502;
      return Response.json(
        {
          message:
            error.code === "insufficient_quota"
              ? "OpenAI quota is not available. Add credits, then retry."
              : provider === "cerebras"
                ? "Cerebras could not complete the page builder request."
                : "OpenAI could not complete the page builder request.",
        },
        { status },
      );
    }

    console.error("page builder AI chat failed", error);
    return Response.json(
      { message: "Could not complete the page builder request." },
      { status: 500 },
    );
  }
}

function parseProvider(body: unknown): SeoAgentProvider {
  if (
    typeof body === "object" &&
    body &&
    "provider" in body &&
    typeof (body as { provider?: unknown }).provider === "string" &&
    providerValues.has((body as { provider: SeoAgentProvider }).provider)
  ) {
    return (body as { provider: SeoAgentProvider }).provider;
  }
  return "openai";
}

function bodyWithoutProvider(body: unknown) {
  if (typeof body !== "object" || !body || !("provider" in body)) return body;
  const rest = { ...(body as Record<string, unknown>) };
  delete rest.provider;
  return rest;
}

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = rateLimits.get(userId);
  if (!current || current.resetAt <= now) {
    rateLimits.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}
