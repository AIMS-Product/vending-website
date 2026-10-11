import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  send: vi.fn(),
  runFailure: vi.fn(),
  exception: vi.fn(),
  config: {
    CRON_SECRET: "cron" as string | undefined,
    GOOGLE_ADS_BOOKED_CALL_WEBHOOK_URL: "https://hooks.example/x" as
      | string
      | undefined,
  },
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/google-ads-booked-calls", () => ({
  loadBookedCallConversions: mocks.load,
  sendBookedCallsToWebhook: mocks.send,
}));
vi.mock("@/lib/observability/cron-failure", () => ({
  reportCronRunFailure: mocks.runFailure,
  reportCronException: mocks.exception,
}));

const req = (auth?: string, q = "") =>
  new Request(
    `https://www.vendingpreneurs.com/api/admin/google-ads-booked-calls/run${q}`,
    { headers: auth ? { authorization: auth } : {} },
  );

describe("GET /api/admin/google-ads-booked-calls/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron";
    mocks.config.GOOGLE_ADS_BOOKED_CALL_WEBHOOK_URL = "https://hooks.example/x";
    mocks.load.mockResolvedValue([{ gclid: "g", conversionTime: "t" }]);
    mocks.send.mockResolvedValue({ sent: 1, failed: 0 });
  });

  it("fails closed without the secret or the webhook url", async () => {
    mocks.config.GOOGLE_ADS_BOOKED_CALL_WEBHOOK_URL = undefined;
    expect((await GET(req("Bearer cron"))).status).toBe(503);
    mocks.config.GOOGLE_ADS_BOOKED_CALL_WEBHOOK_URL = "https://hooks.example/x";
    mocks.config.CRON_SECRET = undefined;
    expect((await GET(req("Bearer cron"))).status).toBe(503);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer and a bad window", async () => {
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect((await GET(req("Bearer cron", "?days=0"))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends the last 7 days to the webhook by default", async () => {
    const res = await GET(req("Bearer cron"));
    expect(res.status).toBe(200);
    expect(mocks.load).toHaveBeenCalledWith(7);
    expect(mocks.send).toHaveBeenCalledWith(
      [{ gclid: "g", conversionTime: "t" }],
      "https://hooks.example/x",
    );
    expect(await res.json()).toEqual({
      ok: true,
      found: 1,
      sent: 1,
      failed: 0,
    });
  });

  it("reports a partial failure as a failed run", async () => {
    mocks.send.mockResolvedValue({ sent: 0, failed: 1 });
    const res = await GET(req("Bearer cron", "?days=2"));
    expect(res.status).toBe(500);
    expect(mocks.load).toHaveBeenCalledWith(2);
    expect(mocks.runFailure).toHaveBeenCalledOnce();
  });

  it("reports a thrown error without leaking it", async () => {
    mocks.load.mockRejectedValue(new Error("db down: secret detail"));
    const res = await GET(req("Bearer cron"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
    expect(mocks.exception).toHaveBeenCalledOnce();
  });
});
