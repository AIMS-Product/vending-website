import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportCopy } from "@/lib/content/masterclass-review-report";

const mocks = vi.hoisted(() => ({
  getAuthorizedAdmin: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/supabase/auth", () => ({
  getAuthorizedAdmin: mocks.getAuthorizedAdmin,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import MasterclassReviewPage from "./page";

describe("/masterclass-review", () => {
  beforeEach(() => {
    mocks.getAuthorizedAdmin.mockReset();
    mocks.notFound.mockClear();
  });

  it("404s an anonymous request and never renders the decisions", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue(null);
    let html = "";
    await expect(
      (async () => {
        html = renderToStaticMarkup(await MasterclassReviewPage());
      })(),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    expect(html).not.toContain(reportCopy.decisionsHeading);
  });

  it("renders the briefing for an allowlisted user", async () => {
    mocks.getAuthorizedAdmin.mockResolvedValue({
      user: { id: "u1", email: "team@example.com" },
      role: "viewer",
    });
    const html = renderToStaticMarkup(await MasterclassReviewPage());
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(html).toContain(reportCopy.decisionsHeading);
  });
});
