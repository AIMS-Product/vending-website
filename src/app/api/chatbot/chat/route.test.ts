import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkPublicRateLimit: vi.fn(),
  result: { data: null, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
}));

vi.mock("@/lib/chatbot/config", () => ({
  loadChatbotConfig: async () => ({ enabled: true }),
}));
vi.mock("@/lib/chatbot/input-budget", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/chatbot/input-budget")
  >("@/lib/chatbot/input-budget");
  return { ...actual, isUnderChatbotDailyCap: async () => true };
});
vi.mock("@/lib/public-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/public-rate-limit")
  >("@/lib/public-rate-limit");
  return { ...actual, checkPublicRateLimit: mocks.checkPublicRateLimit };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) {
      builder[method] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve(mocks.result);
    return { from: () => builder };
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { POST } from "./route";

const request = () =>
  new Request("https://www.vendingpreneurs.com/api/chatbot/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-12345678",
      message: "How much does a machine cost?",
    }),
  });

describe("POST /api/chatbot/chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.checkPublicRateLimit.mockReset();
    mocks.checkPublicRateLimit.mockResolvedValue(true);
    mocks.result = { data: null, error: null };
  });

  it("answers 503 and logs when the conversation lookup fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.result = {
      data: null,
      error: { code: "57P01", message: "terminating connection" },
    };

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      "chatbot: database read failed",
      expect.objectContaining({ route: "chat", code: "57P01" }),
    );
    // An error is not "new conversation": it must not spend that budget.
    expect(mocks.checkPublicRateLimit).not.toHaveBeenCalledWith(
      "chatbot_new_conversation",
      expect.anything(),
    );
  });
});
