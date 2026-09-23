import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: {
    CRON_SECRET: "cron-secret-123456" as string | undefined,
    BITLY_ACCESS_TOKEN: "token_test" as string | undefined,
  },
  syncBitlyClicks: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/bitly-click-sync", () => ({
  syncBitlyClicks: mocks.syncBitlyClicks,
}));

const URL_BASE = "https://www.vendingpreneurs.com/api/admin/bitly-sync/run";

function request(secret?: string, query = "") {
  return new Request(`${URL_BASE}${query}`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("Bitly sync runner route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron-secret-123456";
    mocks.config.BITLY_ACCESS_TOKEN = "token_test";
    mocks.syncBitlyClicks.mockResolvedValue({
      scanned: 12,
      updated: 12,
      failed: 0,
      daysWritten: 360,
      linksMapped: 0,
    });
  });

  it("reports itself unconfigured rather than unauthorized without a secret", async () => {
    mocks.config.CRON_SECRET = undefined;

    const response = await GET(request("anything"));

    expect(response.status).toBe(503);
    expect(mocks.syncBitlyClicks).not.toHaveBeenCalled();
  });

  it("refuses a request with no bearer at all", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.syncBitlyClicks).not.toHaveBeenCalled();
  });

  it("refuses a wrong bearer of either the same or a different length", async () => {
    const short = await GET(request("nope"));
    const sameLength = await GET(request("cron-secret-654321"));

    expect(short.status).toBe(401);
    expect(sameLength.status).toBe(401);
    expect(mocks.syncBitlyClicks).not.toHaveBeenCalled();
  });

  it("rejects a days value that is not a number", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(request("cron-secret-123456", "?days=abc"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Invalid query parameters.",
    });
    expect(mocks.syncBitlyClicks).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("passes both bounded options through to the sync", async () => {
    const response = await GET(
      request("cron-secret-123456", "?days=30&batchSize=80"),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncBitlyClicks).toHaveBeenCalledWith({
      days: 30,
      batchSize: 80,
    });
  });

  it("skips without a token, and calls that a success", async () => {
    mocks.config.BITLY_ACCESS_TOKEN = undefined;

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(mocks.syncBitlyClicks).not.toHaveBeenCalled();
  });

  /**
   * Matches the GA4 runner. A cron that reports green while links silently
   * stop syncing is the blind spot that let bitly_link_clicks sit at zero rows
   * with nobody noticing.
   */
  it("returns 500 when any link failed", async () => {
    mocks.syncBitlyClicks.mockResolvedValue({
      scanned: 12,
      updated: 10,
      failed: 2,
      daysWritten: 300,
      linksMapped: 0,
    });

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, failed: 2 });
  });

  it("stays green when the only bad links are permanently malformed", async () => {
    // A malformed stored id is a data problem for a person to fix, not
    // something the next run can retry. Paging the cron every night for it
    // trains everyone to ignore the alert.
    mocks.syncBitlyClicks.mockResolvedValue({
      scanned: 12,
      updated: 11,
      failed: 0,
      invalid: 1,
      daysWritten: 330,
      linksMapped: 0,
    });

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, invalid: 1 });
  });

  it("returns 500 when Bitly refuses every link in the batch", async () => {
    // A revoked token 403s every link. Each one alone is "invalid", but all of
    // them at once is a token problem, and it must not read green.
    mocks.syncBitlyClicks.mockResolvedValue({
      scanned: 12,
      updated: 0,
      failed: 0,
      invalid: 12,
      daysWritten: 0,
      linksMapped: 0,
    });

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(500);
  });

  it("returns 500 and leaks nothing when the sync throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.syncBitlyClicks.mockRejectedValue(
      new Error("bitly token token_secret_0xDEADBEEF rejected"),
    );

    const response = await GET(request("cron-secret-123456"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("DEADBEEF");
    logged.mockRestore();
  });

  it("succeeds on a clean run", async () => {
    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      scanned: 12,
      updated: 12,
      failed: 0,
    });
  });
});
