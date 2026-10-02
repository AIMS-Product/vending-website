import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  result: { data: null, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
}));

vi.mock("@/lib/chatbot/config", () => ({
  loadChatbotConfig: async () => ({ enabled: true }),
}));
vi.mock("@/lib/public-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/public-rate-limit")
  >("@/lib/public-rate-limit");
  return { ...actual, checkPublicRateLimit: async () => true };
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

import { GET } from "./route";

const request = () =>
  new Request(
    "https://www.vendingpreneurs.com/api/chatbot/history?sessionId=session-12345678",
  );

describe("GET /api/chatbot/history", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.result = { data: null, error: null };
  });

  it("answers 404 when there is no such conversation", async () => {
    const response = await GET(request());

    expect(response.status).toBe(404);
  });

  it("answers 503 and logs when the database read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.result = {
      data: null,
      error: { code: "57P01", message: "terminating connection" },
    };

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: "Chat is temporarily unavailable. Try again shortly.",
    });
    expect(log).toHaveBeenCalledWith(
      "chatbot: database read failed",
      expect.objectContaining({ route: "history", code: "57P01" }),
    );
    // The session id never reaches the log.
    expect(JSON.stringify(log.mock.calls)).not.toContain("session-12345678");
  });
});
