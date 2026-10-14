import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getLinkRegistry: vi.fn(),
  config: { REPORTING_API_KEY: "k3y" as string | undefined },
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/marketing-links", () => ({
  getLinkRegistry: mocks.getLinkRegistry,
}));
vi.mock("@/lib/observability/route-error", () => ({
  reportRouteError: vi.fn(),
}));

const link = {
  id: "l1",
  url: "https://www.vendingpreneurs.com/start?utm_source=newsletter",
  base_url: "https://www.vendingpreneurs.com/start",
  utm_source: "newsletter",
  utm_medium: "email",
  utm_campaign: "masterclass_registration",
  utm_content: "=HYPERLINK(1)",
  utm_term: "",
  label: 'Webinar, "Oct 13"',
  funnel_name: "Internal Webinar",
  funnel_set_by: "sheet",
  owner: null,
  bitly_id: null,
  bitly_url: null,
  created_by: "backfill:sheet",
  created_at: "2026-10-14T00:00:00Z",
  clicks_synced_at: null,
  imported: true,
  problems: [],
  stats: {
    leads: 3,
    booked: 1,
    calendarBookings: 2,
    clicks: null,
    lastLeadAt: "2026-10-01T00:00:00Z",
  },
};

function request(query = "", authorization: string | null = "Bearer k3y") {
  return new Request(
    `https://www.vendingpreneurs.com/api/reporting/links${query}`,
    { headers: authorization ? { authorization } : {} },
  );
}

describe("GET /api/reporting/links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.REPORTING_API_KEY = "k3y";
    mocks.getLinkRegistry.mockResolvedValue({
      links: [link],
      statsFailed: false,
    });
  });

  it("refuses a missing or wrong key", async () => {
    expect((await GET(request("", null))).status).toBe(401);
    expect((await GET(request("", "Bearer nope"))).status).toBe(401);
    expect(mocks.getLinkRegistry).not.toHaveBeenCalled();
  });

  it("answers 503 when the API key is not configured", async () => {
    mocks.config.REPORTING_API_KEY = undefined;
    expect((await GET(request())).status).toBe(503);
  });

  it("returns each link with its funnel and results as JSON", async () => {
    const body = await (await GET(request())).json();
    expect(body.ok).toBe(true);
    expect(body.rows[0]).toMatchObject({
      funnel_name: "Internal Webinar",
      utm_source: "newsletter",
      leads: 3,
      calendar_bookings: 2,
      clicks: null,
    });
  });

  it("returns CSV with quoting and formula cells neutralised", async () => {
    const response = await GET(request("?format=csv"));
    expect(response.headers.get("content-type")).toContain("text/csv");
    const [header, row] = (await response.text()).trim().split("\n");
    expect(header.startsWith("funnel_name,owner,utm_source")).toBe(true);
    expect(row).toContain("'=HYPERLINK(1)");
    expect(row).toContain('"Webinar, ""Oct 13"""');
  });

  it("rejects an unknown format", async () => {
    expect((await GET(request("?format=xml"))).status).toBe(400);
  });
});
