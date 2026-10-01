import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportCopy } from "@/lib/content/masterclass-review-report";

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

import MasterclassReviewPage from "./page";

describe("/masterclass-review", () => {
  beforeEach(() => {
    mocks.getAuthorizedAdmin.mockReset();
    mocks.redirect.mockClear();
  });

  it("sends an anonymous request to the login and never renders the decisions", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue(null);
    let html = "";
    await expect(
      (async () => {
        html = renderToStaticMarkup(await MasterclassReviewPage());
      })(),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/login?next=%2Fmasterclass-review",
    );
    expect(html).not.toContain(reportCopy.decisionsHeading);
  });

  it("renders the briefing for an allowlisted user", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue({
      user: { id: "u1", email: "team@example.com" },
      role: "viewer",
    });
    const html = renderToStaticMarkup(await MasterclassReviewPage());
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(html).toContain(reportCopy.decisionsHeading);
  });
});
