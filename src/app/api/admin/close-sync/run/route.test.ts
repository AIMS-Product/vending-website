import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "cron-secret-123456" as string | undefined },
  runCloseSync: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: mocks.config,
}));

vi.mock("@/lib/close/sync", () => ({
  adminRunCloseSync: mocks.runCloseSync,
}));

function request(secret?: string) {
  return new Request(
    "https://vending-website.vercel.app/api/admin/close-sync/run",
    {
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    },
  );
}

describe("Close sync runner route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron-secret-123456";
    mocks.runCloseSync.mockResolvedValue({
      scanned: 2,
      synced: 1,
      failed: 1,
      deadLettered: 0,
      needsReview: 0,
      skipped: 0,
      errors: [
        { eventId: "event_2", message: "Close API key is not configured." },
      ],
    });
  });

  it("rejects unauthenticated public requests", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, message: "Unauthorized." });
    expect(mocks.runCloseSync).not.toHaveBeenCalled();
  });

  it("rejects bearer tokens with the wrong value or length", async () => {
    const wrongLengthResponse = await GET(request("wrong"));
    const wrongLengthBody = await wrongLengthResponse.json();
    const sameLengthResponse = await GET(request("cron-secret-654321"));
    const sameLengthBody = await sameLengthResponse.json();

    expect(wrongLengthResponse.status).toBe(401);
    expect(wrongLengthBody).toEqual({ ok: false, message: "Unauthorized." });
    expect(sameLengthResponse.status).toBe(401);
    expect(sameLengthBody).toEqual({ ok: false, message: "Unauthorized." });
    expect(mocks.runCloseSync).not.toHaveBeenCalled();
  });

  it("rejects requests when the cron secret is not configured", async () => {
    mocks.config.CRON_SECRET = undefined;

    const response = await GET(request("cron-secret-123456"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      message: "Close sync runner is not configured.",
    });
    expect(mocks.runCloseSync).not.toHaveBeenCalled();
  });

  it("runs Close sync for the expected bearer secret", async () => {
    const response = await GET(request("cron-secret-123456"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      scanned: 2,
      synced: 1,
      failed: 1,
      deadLettered: 0,
      needsReview: 0,
    });
    expect(body.errors).toEqual([
      { eventId: "event_2", message: "Close API key is not configured." },
    ]);
    expect(mocks.runCloseSync).toHaveBeenCalledTimes(1);
  });

  it("returns a safe failed summary when the runner throws", async () => {
    const runnerError = new Error("close_key_123 leaked");
    mocks.runCloseSync.mockRejectedValue(runnerError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await GET(request("cron-secret-123456"));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        message: "Close sync runner failed.",
      });
      expect(consoleError).toHaveBeenCalledWith("close sync runner failed", {
        name: "Error",
      });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "close_key_123",
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("logs a generic error name for non-Error runner failures", async () => {
    mocks.runCloseSync.mockRejectedValue("close_key_123 leaked");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await GET(request("cron-secret-123456"));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        message: "Close sync runner failed.",
      });
      expect(consoleError).toHaveBeenCalledWith("close sync runner failed", {
        name: "UnknownError",
      });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "close_key_123",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
