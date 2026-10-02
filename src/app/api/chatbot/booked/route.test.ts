import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  result: { data: null, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
  getInvitee: vi.fn(),
}));

vi.mock("@/lib/public-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/public-rate-limit")
  >("@/lib/public-rate-limit");
  return { ...actual, checkPublicRateLimit: async () => true };
});
vi.mock("@/lib/services/calendly-api", () => ({
  createCalendlyApiClient: () => ({ getInvitee: mocks.getInvitee }),
}));
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

import { POST } from "./route";

const request = () =>
  new Request("https://www.vendingpreneurs.com/api/chatbot/booked", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-12345678",
      inviteeUri: "https://api.calendly.com/scheduled_events/e1/invitees/i1",
    }),
  });

describe("POST /api/chatbot/booked", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getInvitee.mockReset();
    mocks.result = { data: null, error: null };
  });

  it("answers 404 when the session has no conversation", async () => {
    const response = await POST(request());

    expect(response.status).toBe(404);
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
      expect.objectContaining({ route: "booked", code: "57P01" }),
    );
    // A database outage must not be mistaken for an unrelated booking.
    expect(mocks.getInvitee).not.toHaveBeenCalled();
  });
  it("answers 404 for a cancelled invitee and records nothing", async () => {
    mocks.result = { data: { id: "conv-1" }, error: null };
    mocks.getInvitee.mockResolvedValue({
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/i1",
      email: "guest@example.test",
      name: "Guest",
      status: "canceled",
      created_at: "2026-09-18T12:00:00.000000Z",
      tracking: { utm_content: "conv-1" },
    });

    const response = await POST(request());

    expect(response.status).toBe(404);
  });
});
