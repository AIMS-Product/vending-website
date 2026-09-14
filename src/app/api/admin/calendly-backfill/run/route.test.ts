import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: {
    CRON_SECRET: "cron-secret-123456" as string | undefined,
    CALENDLY_API_TOKEN: "tok" as string | undefined,
  },
  reconcile: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/chatbot/booking-reconcile", () => ({
  reconcileChatbotBookings: mocks.reconcile,
}));
vi.mock("@/lib/services/calendly-api", () => ({
  createCalendlyApiClient: () => ({ getUser: mocks.getUser }),
}));

function request(query = "", secret: string | null = "cron-secret-123456") {
  return new Request(
    `https://www.vendingpreneurs.com/api/admin/calendly-backfill/run${query}`,
    { headers: secret ? { Authorization: `Bearer ${secret}` } : undefined },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.CRON_SECRET = "cron-secret-123456";
  mocks.reconcile.mockResolvedValue({ configured: true, bookingsRecorded: 3 });
  mocks.getUser.mockResolvedValue({
    uri: "https://api.calendly.com/users/abc",
    name: "Robin Rep",
    email: "robin@example.com",
  });
});

describe("calendly backfill runner", () => {
  it("refuses a missing or wrong secret", async () => {
    expect((await GET(request("?from=2026-06-01", null))).status).toBe(401);
    expect(
      (await GET(request("?from=2026-06-01", "nope-nope-nope"))).status,
    ).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs the sweep over an explicit window with the backfill request cap", async () => {
    const response = await GET(request("?from=2026-06-01&to=2026-07-01"));
    expect(response.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith({
      from: "2026-06-01",
      to: "2026-07-01",
      dryRun: undefined,
      maxRequests: 4000,
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      bookingsRecorded: 3,
    });
  });

  it("requires from and rejects a malformed date", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("?from=June"))).status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("names Calendly users instead of sweeping when users= is passed", async () => {
    const response = await GET(request("?users=abc,def"));
    expect(mocks.getUser.mock.calls.map(([id]) => id)).toEqual(["abc", "def"]);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      users: [
        expect.objectContaining({ name: "Robin Rep" }),
        expect.objectContaining({ name: "Robin Rep" }),
      ],
    });
  });
});
