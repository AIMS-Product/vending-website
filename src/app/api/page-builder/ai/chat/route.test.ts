import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";
import { generateOpenAiPageBuilderChatResponse } from "@/lib/services/openai-page-builder-chat";
import type { PageBuilderAiChatRequest } from "@/lib/page-builder/ai-chat";

vi.mock("@/lib/supabase/auth", async () => {
  // canEditAdmin stays real: mocking the predicate under test would let a
  // viewer pass this route's gate in the test and nowhere else.
  const actual = await vi.importActual<typeof import("@/lib/supabase/auth")>(
    "@/lib/supabase/auth",
  );
  return { ...actual, getAuthorizedAdmin: vi.fn() };
});

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
      role: "admin",
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

  it("refuses a read-only viewer even though they are on the allowlist", async () => {
    // The regression this locks: the route gated on "getAuthorizedAdmin
    // returned something", and a viewer returns something. Without the role
    // check a read-only account could drive the page-builder model.
    mockGetAuthorizedAdmin.mockResolvedValue({
      user: { id: "viewer_1", email: "viewer@example.com" },
      role: "viewer",
    } as Awaited<ReturnType<typeof getAuthorizedAdmin>>);

    const response = await POST(jsonRequest(validRequest));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Forbidden." });
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
