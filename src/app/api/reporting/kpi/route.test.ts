import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getKpiTab: vi.fn(),
  config: { REPORTING_API_KEY: "k3y" as string | undefined },
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/kpi-report-data", () => ({
  getKpiTab: mocks.getKpiTab,
}));

const report = {
  sections: [
    {
      key: "funnels",
      title: "Content and website funnels",
      basis: "",
      columns: [{ key: "leads", label: "Leads", format: "number" }],
      rows: [
        {
          key: "YouTube|book-call",
          label: "YouTube",
          detail: "Direct booking",
          values: { leads: 12 },
          sourceOfTruth: "leads",
          owner: "Ayman",
          cadence: "Weekly",
          lastVerified: null,
        },
      ],
      hidden: 0,
    },
  ],
};

function request(query = "", authorization?: string) {
  return new Request(
    `https://www.vendingpreneurs.com/api/reporting/kpi${query}`,
    { headers: authorization ? { authorization } : {} },
  );
}

describe("GET /api/reporting/kpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.REPORTING_API_KEY = "k3y";
    mocks.getKpiTab.mockResolvedValue({ connected: true, report });
  });

  it("requires the bearer key", async () => {
    expect((await GET(request())).status).toBe(401);
    mocks.config.REPORTING_API_KEY = undefined;
    expect((await GET(request("", "Bearer k3y"))).status).toBe(503);
  });

  it("rejects unknown range and format", async () => {
    expect((await GET(request("?range=2d", "Bearer k3y"))).status).toBe(400);
    expect((await GET(request("?format=xml", "Bearer k3y"))).status).toBe(400);
  });

  it("returns JSON by default", async () => {
    const response = await GET(request("?range=90d", "Bearer k3y"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, connected: true });
    expect(mocks.getKpiTab).toHaveBeenCalledWith({ range: "90d" });
  });

  it("returns CSV when asked", async () => {
    const response = await GET(request("?format=csv", "Bearer k3y"));
    expect(response.headers.get("content-type")).toContain("text/csv");
    const body = await response.text();
    expect(body.split("\n")[0]).toBe(
      "Section,Row,Detail,Leads,Source of truth,Owner,Cadence,Last verified",
    );
    expect(body).toContain(
      "Content and website funnels,YouTube,Direct booking,12,leads,Ayman,Weekly,",
    );
  });
});
