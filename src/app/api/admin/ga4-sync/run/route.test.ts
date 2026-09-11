import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: {
    CRON_SECRET: "cron-secret-123456" as string | undefined,
    GA4_SERVICE_ACCOUNT_JSON: undefined as string | undefined,
    GA4_PROPERTY_ID: undefined as string | undefined,
  },
  syncGa4PageViews: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/ga4-page-view-sync", () => ({
  syncGa4PageViews: mocks.syncGa4PageViews,
}));

const URL_BASE = "https://www.vendingpreneurs.com/api/admin/ga4-sync/run";

function request(secret?: string, query = "") {
  return new Request(`${URL_BASE}${query}`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("GA4 sync runner route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron-secret-123456";
    mocks.config.GA4_SERVICE_ACCOUNT_JSON = undefined;
    mocks.config.GA4_PROPERTY_ID = undefined;
    mocks.syncGa4PageViews.mockResolvedValue({
      connected: true,
      scanned: 120,
      daysWritten: 120,
      failed: 0,
    });
  });

  it("reports itself unconfigured rather than unauthorized without a secret", async () => {
    mocks.config.CRON_SECRET = undefined;

    const response = await GET(request("anything"));

    expect(response.status).toBe(503);
    expect(mocks.syncGa4PageViews).not.toHaveBeenCalled();
  });

  it("refuses a request with no bearer at all", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Unauthorized.",
    });
    expect(mocks.syncGa4PageViews).not.toHaveBeenCalled();
  });

  it("refuses a wrong bearer of either the same or a different length", async () => {
    // Different length short-circuits before timingSafeEqual; same length is
    // the case that actually reaches the comparison.
    const short = await GET(request("nope"));
    const sameLength = await GET(request("cron-secret-654321"));

    expect(short.status).toBe(401);
    expect(sameLength.status).toBe(401);
    expect(mocks.syncGa4PageViews).not.toHaveBeenCalled();
  });

  it("rejects a days value that is not a number", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(request("cron-secret-123456", "?days=abc"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Invalid query parameters.",
    });
    expect(mocks.syncGa4PageViews).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("passes a valid days window through to the sync", async () => {
    const response = await GET(request("cron-secret-123456", "?days=400"));

    expect(response.status).toBe(200);
    expect(mocks.syncGa4PageViews).toHaveBeenCalledWith({ days: 400 });
  });

  it("returns 500 when any chunk failed", async () => {
    mocks.syncGa4PageViews.mockResolvedValue({
      connected: true,
      scanned: 120,
      daysWritten: 60,
      failed: 2,
    });

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, failed: 2 });
  });

  /**
   * Both vars set but no client means the key itself is unreadable. That is an
   * outage, and it must not report green every night while the table goes
   * stale.
   */
  it("returns 500 when GA4 is configured but its key cannot be read", async () => {
    mocks.config.GA4_SERVICE_ACCOUNT_JSON = "{bad json";
    mocks.config.GA4_PROPERTY_ID = "123456";
    mocks.syncGa4PageViews.mockResolvedValue({
      connected: false,
      scanned: 0,
      daysWritten: 0,
      failed: 0,
    });

    const response = await GET(request("cron-secret-123456"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.message).toContain("key could not be read");
  });

  it("stays green when GA4 is simply not configured", async () => {
    mocks.syncGa4PageViews.mockResolvedValue({
      connected: false,
      scanned: 0,
      daysWritten: 0,
      failed: 0,
    });

    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, connected: false });
  });

  it("returns 500 and leaks nothing when the sync throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.syncGa4PageViews.mockRejectedValue(
      new Error("service account key 0xDEADBEEF rejected"),
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
      scanned: 120,
      daysWritten: 120,
      failed: 0,
    });
  });
});
