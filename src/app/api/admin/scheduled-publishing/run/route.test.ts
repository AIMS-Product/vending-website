import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "cron-secret-123456" as string | undefined },
  runScheduledSeoPagePublishing: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: mocks.config,
}));

vi.mock("@/lib/services/seo-page-scheduler", () => ({
  adminRunScheduledSeoPagePublishing: mocks.runScheduledSeoPagePublishing,
}));

function request(secret?: string) {
  return new Request(
    "https://vending-website.vercel.app/api/admin/scheduled-publishing/run",
    {
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    },
  );
}

describe("scheduled publishing cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron-secret-123456";
    mocks.runScheduledSeoPagePublishing.mockResolvedValue({
      scanned: 1,
      claimed: 1,
      published: 1,
      failed: 0,
      retried: 0,
      skipped: 0,
      errors: [],
    });
  });

  it("rejects unauthenticated public requests", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.runScheduledSeoPagePublishing).not.toHaveBeenCalled();
  });

  it("rejects bearer tokens with the wrong value or length", async () => {
    const response = await GET(request("wrong"));

    expect(response.status).toBe(401);
    expect(mocks.runScheduledSeoPagePublishing).not.toHaveBeenCalled();
  });

  it("rejects requests when the cron secret is not configured", async () => {
    mocks.config.CRON_SECRET = undefined;

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(503);
    expect(mocks.runScheduledSeoPagePublishing).not.toHaveBeenCalled();
  });

  it("runs the scheduler for the expected bearer secret", async () => {
    const response = await GET(request("cron-secret-123456"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, published: 1, failed: 0 });
    expect(mocks.runScheduledSeoPagePublishing).toHaveBeenCalledTimes(1);
  });

  it("returns a safe failed summary when the scheduler throws", async () => {
    const schedulerError = new Error("connection string leaked");
    mocks.runScheduledSeoPagePublishing.mockRejectedValue(
      schedulerError,
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await GET(request("cron-secret-123456"));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        message: "Scheduled publishing runner failed.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "scheduled publishing runner failed",
        { name: "Error" },
      );
      expect(consoleError.mock.calls[0]?.[1]).not.toBe(schedulerError);
      expect(JSON.stringify(consoleError.mock.calls[0])).not.toContain(
        "connection string leaked",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
