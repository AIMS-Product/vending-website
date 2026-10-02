import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "cron-secret-123456" as string | undefined },
  sendDataReport: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/data-report-data", () => ({
  sendDataReport: mocks.sendDataReport,
}));

function request(query = "", secret: string | null = "cron-secret-123456") {
  return new Request(
    `https://www.vendingpreneurs.com/api/admin/data-report/run${query}`,
    { headers: secret ? { Authorization: `Bearer ${secret}` } : undefined },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.CRON_SECRET = "cron-secret-123456";
  mocks.sendDataReport.mockResolvedValue({
    sent: true,
    period: "day",
    window: {},
    subject: "s",
    error: null,
    report: { text: "t" },
  });
});

describe("data report runner", () => {
  it("refuses a missing or wrong secret", async () => {
    expect((await GET(request("", null))).status).toBe(401);
    expect((await GET(request("", "nope-nope-nope-1234"))).status).toBe(401);
    expect(mocks.sendDataReport).not.toHaveBeenCalled();
  });

  it.each([
    ["", undefined],
    ["?dryRun=true", true],
    ["?dryRun=1", true],
    ["?dryRun=false", false],
    ["?dryRun=0", false],
  ])("reads %s as dryRun %s", async (query, expected) => {
    await GET(request(query));
    expect(mocks.sendDataReport).toHaveBeenCalledWith({
      period: "day",
      dryRun: expected,
    });
  });

  it("rejects an unrecognised dryRun value instead of guessing", async () => {
    expect((await GET(request("?dryRun=yes"))).status).toBe(400);
    expect(mocks.sendDataReport).not.toHaveBeenCalled();
  });
});
