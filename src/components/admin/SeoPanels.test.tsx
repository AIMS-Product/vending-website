import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/seo/actions", () => ({
  addTask: vi.fn(),
  saveMonthlyReview: vi.fn(),
  updatePieceStatus: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

import { SeoOverviewTab, SeoTasksTab } from "./SeoPanels";
import { SCORECARD } from "@/lib/services/seo-scorecard";

const totals = { impressions: 6365, clicks: 584, ctrPct: 9.2, position: 10.7 };

describe("SeoPanels", () => {
  it("renders the overview with the cutover marker and no dashes in copy", () => {
    const html = renderToStaticMarkup(
      <SeoOverviewTab
        data={{
          missing: false,
          daily: [
            {
              day: "2026-07-26",
              impressions: 500,
              clicks: 30,
              position: 9,
              brandImpressions: 200,
            },
            {
              day: "2026-07-27",
              impressions: 400,
              clicks: 20,
              position: 10,
              brandImpressions: 150,
            },
            {
              day: "2026-07-28",
              impressions: 300,
              clicks: 25,
              position: 11,
              brandImpressions: 120,
            },
          ],
          asOf: "2026-07-28",
          current: totals,
          prior: { ...totals, impressions: 9320 },
          lastYear: null,
          brandShareCurrent: 0.4,
          markers: [{ day: "2026-07-27", label: "Webflow to Next.js" }],
          livePagesByDay: [],
          movers: { pages: [], queries: [] },
        }}
        scorecard={{
          asOf: "2026-07-28",
          day0: {
            day: "2026-07-01",
            values: { nonbrand_impressions_7d: 1287 },
          },
          current: { nonbrand_impressions_7d: 1544 },
          rows: SCORECARD,
        }}
      />,
    );
    expect(html).toContain("Scorecard vs Day 0");
    expect(html).toContain("1,287");
    expect(html).toContain("4,500");
    expect(html).toContain("Branded vs non-branded impressions");
    expect(html).toContain("6,365");
    expect(html).toContain("2026-07-27: Webflow to Next.js");
    expect(html).not.toMatch(/—|–/);
  });

  it("hides task buttons from a viewer and flags overdue work", () => {
    const html = renderToStaticMarkup(
      <SeoTasksTab
        canEdit={false}
        status="open"
        today="2026-09-29"
        tasks={[
          {
            id: "t1",
            type: "publish",
            title: "Publish 1.1",
            priority: "high",
            status: "open",
            due_date: "2026-09-28",
            trigger_code: null,
            evidence: {},
          } as never,
        ]}
      />,
    );
    expect(html).toContain("Publish 1.1");
    expect(html).not.toContain("Mark done");
    expect(html).not.toContain("Add a task");
    expect(html).toContain("text-ui-bad");
  });
});
