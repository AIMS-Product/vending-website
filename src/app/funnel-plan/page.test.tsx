import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizedAdmin: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

vi.mock("@/lib/supabase/auth", () => ({
  getAuthorizedAdmin: mocks.getAuthorizedAdmin,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import FunnelPlanPage from "./page";

describe("/funnel-plan", () => {
  beforeEach(() => {
    mocks.getAuthorizedAdmin.mockReset();
    mocks.redirect.mockClear();
  });

  it("sends an anonymous request to the login and never renders the plan", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue(null);
    await expect(FunnelPlanPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/login?next=%2Ffunnel-plan",
    );
  });

  it("renders the plan with its tables for a signed-in team member", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue({ id: "u1" });
    const html = renderToStaticMarkup(await FunnelPlanPage());
    expect(html).toContain("Content funnel plan");
    expect(html).toContain("<table>");
    expect(html).toContain("Where buyers search");
  });
});

describe("labelTableCells", () => {
  it("stamps each cell with its column header", async () => {
    const { labelTableCells } = await import("@/lib/html-table-labels");
    const html =
      "<table><thead><tr><th>Topic</th><th>Monthly US searches</th></tr></thead><tbody><tr><td>Locators</td><td>2,400</td></tr></tbody></table>";
    expect(labelTableCells(html)).toContain(
      '<td data-label="Topic">Locators</td><td data-label="Monthly US searches">2,400</td>',
    );
  });
});

describe("labelTableCells wide cells", () => {
  it("marks long text cells as full-width on phones", async () => {
    const { labelTableCells } = await import("@/lib/html-table-labels");
    const html =
      "<table><thead><tr><th>Topic</th></tr></thead><tbody><tr><td>Our YouTube video ranks number two</td></tr></tbody></table>";
    expect(labelTableCells(html)).toContain('data-label="Topic" data-wide>');
  });
});

describe("funnel cheat sheet", () => {
  it("opens the signed-in page with the three funnel stages", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue({ id: "u1" });
    const html = renderToStaticMarkup(await FunnelPlanPage());
    const first = html.indexOf("TOFU");
    expect(first).toBeGreaterThan(-1);
    expect(html.indexOf("MOFU")).toBeGreaterThan(first);
    expect(html.indexOf("BOFU")).toBeGreaterThan(html.indexOf("MOFU"));
    expect(first).toBeLessThan(html.indexOf("Key numbers"));
  });
});

describe("improvement list", () => {
  it("shows the full improvement list between the plan and the build order", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue({ id: "u1" });
    const html = renderToStaticMarkup(await FunnelPlanPage());
    const list = html.indexOf("7. Full improvement list, by funnel stage");
    expect(list).toBeGreaterThan(html.indexOf("6. The plan"));
    expect(list).toBeLessThan(html.indexOf("8. Build order"));
    expect(html).toContain("After the lead (speed to lead, setters, shows)");
  });
});
