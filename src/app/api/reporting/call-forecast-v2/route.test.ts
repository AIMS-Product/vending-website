import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ key: "test-only-secret", report: vi.fn() }));
vi.mock("@/lib/config", () => ({
  config: {
    get REPORTING_API_KEY() {
      return m.key;
    },
  },
}));
vi.mock("@/lib/services/booking-production-v2", () => ({
  getProductionV2: m.report,
}));
import { GET } from "./route";
beforeEach(() => {
  m.key = "test-only-secret";
  m.report.mockReset();
  m.report.mockResolvedValue({ schemaVersion: 2, ok: true });
});
describe("private V2 reporting", () => {
  it("refuses anonymous and wrong bearer before reading data", async () => {
    for (const authorization of [undefined, "Bearer wrong"]) {
      const r = await GET(
        new Request(
          "https://example.com/api/reporting/call-forecast-v2?details=1",
          { headers: authorization ? { authorization } : {} },
        ),
      );
      expect(r.status).toBe(401);
    }
    expect(m.report).not.toHaveBeenCalled();
  });
  it("returns aggregate by default and private details only when explicitly requested", async () => {
    for (const suffix of ["", "?details=1"]) {
      const r = await GET(
        new Request(
          "https://example.com/api/reporting/call-forecast-v2" + suffix,
          { headers: { authorization: "Bearer test-only-secret" } },
        ),
      );
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(m.report).toHaveBeenLastCalledWith(suffix !== "");
    }
  });
  it("source failure never becomes a zero report or leaks the error", async () => {
    m.report.mockRejectedValue(new Error("private source content"));
    const r = await GET(
      new Request("https://example.com/api/reporting/call-forecast-v2", {
        headers: { authorization: "Bearer test-only-secret" },
      }),
    );
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private source content");
  });
  it("missing configuration is explicit", async () => {
    m.key = "";
    const r = await GET(
      new Request("https://example.com/api/reporting/call-forecast-v2"),
    );
    expect(r.status).toBe(503);
  });
});
