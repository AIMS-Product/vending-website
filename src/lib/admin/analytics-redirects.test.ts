import { describe, expect, it } from "vitest";
import { ADMIN_ANALYTICS_REDIRECTS } from "./analytics-redirects";

describe("admin analytics redirects", () => {
  it("never sends /admin/analytics back to itself (the query is kept, so it would loop)", () => {
    for (const rule of ADMIN_ANALYTICS_REDIRECTS) {
      if (rule.source === "/admin/analytics") {
        expect(rule.destination.split("#")[0]).not.toBe("/admin/analytics");
      }
    }
  });

  it("moves every retired page and every tab with a page of its own", () => {
    const sources = ADMIN_ANALYTICS_REDIRECTS.map(
      (r) => `${r.source}${r.has ? `?tab=${r.has[0]!.value}` : ""}`,
    );
    expect(sources).toEqual([
      "/admin",
      "/admin/goals",
      "/admin/analytics?tab=channels",
      "/admin/analytics?tab=youtube",
      "/admin/analytics?tab=video",
      "/admin/analytics?tab=(mom|close)",
    ]);
    expect(ADMIN_ANALYTICS_REDIRECTS.every((r) => r.statusCode === 301)).toBe(
      true,
    );
  });
});
