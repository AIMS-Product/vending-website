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
