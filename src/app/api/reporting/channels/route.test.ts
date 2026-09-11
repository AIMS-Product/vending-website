import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getChannelsTab: vi.fn(),
  config: { REPORTING_API_KEY: "k3y" as string | undefined },
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/channel-report", () => ({
  getChannelsTab: mocks.getChannelsTab,
}));

function request(query = "", authorization?: string) {
  return new Request(
    `https://www.vendingpreneurs.com/api/reporting/channels${query}`,
    { headers: authorization ? { authorization } : {} },
  );
}

describe("GET /api/reporting/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.REPORTING_API_KEY = "k3y";
    mocks.getChannelsTab.mockResolvedValue({ connected: true, report: {} });
  });

  it("answers 503 when the key is not configured", async () => {
    mocks.config.REPORTING_API_KEY = undefined;
    expect((await GET(request("", "Bearer k3y"))).status).toBe(503);
  });

  it("rejects a missing or wrong bearer", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("", "Bearer nope"))).status).toBe(401);
    expect(mocks.getChannelsTab).not.toHaveBeenCalled();
  });

  it("rejects an unknown range instead of silently defaulting", async () => {
    const response = await GET(request("?range=45d", "Bearer k3y"));
    expect(response.status).toBe(400);
    expect(mocks.getChannelsTab).not.toHaveBeenCalled();
  });

  it("returns the Channels tab data for the range and channel asked", async () => {
    const response = await GET(
      request("?range=90d&channel=YouTube", "Bearer k3y"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: true,
      connected: true,
    });
    expect(mocks.getChannelsTab).toHaveBeenCalledWith({
      range: "90d",
      channel: "YouTube",
    });
  });

  it("defaults to 30 days and no channel", async () => {
    await GET(request("", "Bearer k3y"));
    expect(mocks.getChannelsTab).toHaveBeenCalledWith({
      range: "30d",
      channel: null,
    });
  });

  it("answers 500 without leaking the error when the report fails", async () => {
    mocks.getChannelsTab.mockRejectedValue(new Error("db down"));
    const response = await GET(request("", "Bearer k3y"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("db down");
  });
});
