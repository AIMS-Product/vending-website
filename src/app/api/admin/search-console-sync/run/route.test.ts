import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "cron-secret-123456" as string | undefined },
  syncSearchConsole: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/search-console-sync", () => ({
  syncSearchConsole: mocks.syncSearchConsole,
}));

const URL_BASE =
  "https://www.vendingpreneurs.com/api/admin/search-console-sync/run";

function request(secret?: string, query = "") {
  return new Request(`${URL_BASE}${query}`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}

const run = (error: string | null, rowsWritten = 0) => ({
  endDate: "2026-09-22",
  connector: { connector: "search-console", rowsWritten, error },
});

describe("Search Console sync runner route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.CRON_SECRET = "cron-secret-123456";
    mocks.syncSearchConsole.mockResolvedValue(run(null, 10));
  });

  it("answers 503 when no cron secret is configured", async () => {
    mocks.config.CRON_SECRET = undefined;
    const response = await GET(request("anything"));
    expect(response.status).toBe(503);
    expect(mocks.syncSearchConsole).not.toHaveBeenCalled();
  });

  it("refuses a request with no bearer, or the wrong one", async () => {
    const none = await GET(request());
    const wrong = await GET(request("cron-secret-654321"));

    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ ok: false, message: "Unauthorized." });
    expect(wrong.status).toBe(401);
    expect(mocks.syncSearchConsole).not.toHaveBeenCalled();
  });

  it("passes a backfill window through, up to Search Console's 16 months", async () => {
    const response = await GET(request("cron-secret-123456", "?days=480"));

    expect(response.status).toBe(200);
    expect(mocks.syncSearchConsole).toHaveBeenCalledWith({ days: 480 });
  });

  it("rejects a window past what Search Console keeps", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request("cron-secret-123456", "?days=501"));

    expect(response.status).toBe(400);
    expect(mocks.syncSearchConsole).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("stays green on a skip and a clean run", async () => {
    mocks.syncSearchConsole.mockResolvedValueOnce(
      run("skipped: GSC_SITE_URL is not set."),
    );
    const skippedRun = await GET(request("cron-secret-123456"));
    const clean = await GET(request("cron-secret-123456"));

    expect(skippedRun.status).toBe(200);
    expect(clean.status).toBe(200);
    expect(await clean.json()).toMatchObject({ ok: true });
  });

  it("returns 500 on a failed run", async () => {
    mocks.syncSearchConsole.mockResolvedValue(
      run("Error: Search Console request failed with HTTP 403: denied"),
    );
    const response = await GET(request("cron-secret-123456"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
