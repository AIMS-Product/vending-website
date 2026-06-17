import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "cron-secret-123456" as string | undefined },
  runQualificationLifecycle: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: mocks.config,
}));

vi.mock("@/lib/services/qualification-lifecycle", () => ({
  adminRunQualificationLifecycle: mocks.runQualificationLifecycle,
}));

function request(secret?: string) {
  return new Request(
    "https://vending-website.vercel.app/api/admin/qualification-lifecycle/run",
    {
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    },
  );
}

describe("qualification lifecycle runner route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron-secret-123456";
    mocks.runQualificationLifecycle.mockResolvedValue({
      scanned: 3,
      markedStale: 1,
      markedExpired: 1,
      taskEventsCreated: 1,
      taskEventsSkipped: 1,
      skipped: 0,
      errors: [],
    });
  });

  it("rejects unauthenticated public requests", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.runQualificationLifecycle).not.toHaveBeenCalled();
  });

  it("rejects bearer tokens with the wrong value or length", async () => {
    const response = await GET(request("wrong"));

    expect(response.status).toBe(401);
    expect(mocks.runQualificationLifecycle).not.toHaveBeenCalled();
  });

  it("rejects requests when the cron secret is not configured", async () => {
    mocks.config.CRON_SECRET = undefined;

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(503);
    expect(mocks.runQualificationLifecycle).not.toHaveBeenCalled();
  });

  it("runs the lifecycle job for the expected bearer secret", async () => {
    const response = await GET(request("cron-secret-123456"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      scanned: 3,
      markedStale: 1,
      markedExpired: 1,
      taskEventsCreated: 1,
      taskEventsSkipped: 1,
      skipped: 0,
    });
    expect(mocks.runQualificationLifecycle).toHaveBeenCalledTimes(1);
  });

  it("returns a safe failed summary when the runner throws", async () => {
    const runnerError = new Error("service-role-key leaked");
    mocks.runQualificationLifecycle.mockRejectedValue(runnerError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await GET(request("cron-secret-123456"));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        ok: false,
        message: "Qualification lifecycle runner failed.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification lifecycle runner failed",
        { name: "Error" },
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        "service-role-key leaked",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
