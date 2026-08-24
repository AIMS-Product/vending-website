import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "cron-secret-123456" as string | undefined },
  reconcile: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: mocks.config,
}));

vi.mock("@/lib/chatbot/booking-reconcile", () => ({
  reconcileChatbotBookings: mocks.reconcile,
}));

const EMPTY_RESULT = {
  configured: true,
  dryRun: false,
  eventsScanned: 0,
  inviteesSeen: 0,
  bookingsRecorded: 0,
  attributed: { inChat: 0, emailMatch: 0 },
  skipped: 0,
  errors: [],
};

function request(query = "", secret: string | null = "cron-secret-123456") {
  return new Request(
    `https://vending-website.vercel.app/api/admin/chatbot-booking-reconcile/run${query}`,
    { headers: secret ? { Authorization: `Bearer ${secret}` } : undefined },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.CRON_SECRET = "cron-secret-123456";
  mocks.reconcile.mockResolvedValue(EMPTY_RESULT);
});

describe("chatbot booking reconcile runner", () => {
  it("refuses a request with no bearer token", async () => {
    const response = await GET(request("", null));
    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    const response = await GET(request("", "not-the-secret-1234"));
    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("reports not configured when no cron secret is set", async () => {
    mocks.config.CRON_SECRET = undefined;
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs with no options by default", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(mocks.reconcile).toHaveBeenCalledWith({
      lookbackDays: undefined,
      dryRun: undefined,
    });
  });

  // z.coerce.boolean() treats every non-empty string as true, so "?dryRun=false"
  // used to mean dryRun: true and a real run would silently be a rehearsal.
  it.each([
    ["?dryRun=true", true],
    ["?dryRun=1", true],
    ["?dryRun=false", false],
    ["?dryRun=0", false],
  ])("parses %s as dryRun=%s", async (query, expected) => {
    await GET(request(query));
    expect(mocks.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: expected }),
    );
  });

  it("passes a lookback window through", async () => {
    await GET(request("?lookbackDays=90"));
    expect(mocks.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ lookbackDays: 90 }),
    );
  });

  it.each([
    "?dryRun=yes",
    "?lookbackDays=0",
    "?lookbackDays=-1",
    "?lookbackDays=abc",
  ])("rejects invalid options: %s", async (query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking the error when the sweep throws", async () => {
    mocks.reconcile.mockRejectedValue(new Error("calendly token abc123 bad"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("abc123");
  });
});
