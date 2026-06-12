import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";
import { generateOpenAiPageBuilderChatResponse } from "@/lib/services/openai-page-builder-chat";
import type { PageBuilderAiChatRequest } from "@/lib/page-builder/ai-chat";

vi.mock("@/lib/supabase/auth", () => ({
  getAuthorizedAdmin: vi.fn(),
}));

vi.mock("@/lib/services/openai-page-builder-chat", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/openai-page-builder-chat")
  >("@/lib/services/openai-page-builder-chat");
  return {
    ...actual,
    generateOpenAiPageBuilderChatResponse: vi.fn(),
  };
});

const mockGetAuthorizedAdmin = vi.mocked(getAuthorizedAdmin);
const mockGenerateOpenAiPageBuilderChatResponse = vi.mocked(
  generateOpenAiPageBuilderChatResponse,
);

const validRequest: PageBuilderAiChatRequest = {
  messages: [{ role: "user", content: "Draft the page." }],
  context: {
    pageId: null,
    status: "draft",
    title: "",
    slug: "",
    pageType: "resource",
    templateKey: "blank",
    targetKeyword: "",
    seoTitle: "",
    metaDescription: "",
    selectedBlockId: null,
    content: { version: 1, sections: [] },
    publishReadiness: {
      blockers: ["Publish requires at least one CTA or lead form block."],
      warnings: [],
      opportunities: [],
    },
  },
};

describe("page builder AI chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthorizedAdmin.mockResolvedValue({
      user: { id: "admin_1" },
    } as Awaited<ReturnType<typeof getAuthorizedAdmin>>);
    mockGenerateOpenAiPageBuilderChatResponse.mockResolvedValue({
      message: "Drafted the page.",
      toolCalls: [],
    });
  });

  it("requires an authorized admin", async () => {
    mockGetAuthorizedAdmin.mockResolvedValue(null);

    const response = await POST(jsonRequest(validRequest));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Unauthorized." });
    expect(mockGenerateOpenAiPageBuilderChatResponse).not.toHaveBeenCalled();
  });

  it("validates the request body before calling the model", async () => {
    const response = await POST(jsonRequest({ messages: [] }));

    expect(response.status).toBe(400);
    expect(mockGenerateOpenAiPageBuilderChatResponse).not.toHaveBeenCalled();
  });

  it("passes a valid request to the OpenAI service", async () => {
    const response = await POST(jsonRequest(validRequest));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Drafted the page.",
      toolCalls: [],
    });
    expect(mockGenerateOpenAiPageBuilderChatResponse).toHaveBeenCalledWith(
      validRequest,
    );
  });

  it("ignores a legacy provider key from older clients", async () => {
    const response = await POST(
      jsonRequest({ ...validRequest, provider: "openai" }),
    );

    expect(response.status).toBe(200);
    expect(mockGenerateOpenAiPageBuilderChatResponse).toHaveBeenCalledWith(
      validRequest,
    );
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/page-builder/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
