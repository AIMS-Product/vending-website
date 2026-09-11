import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YouTubeVideoTable } from "./YouTubeAttributionPanels";
import type { YouTubeVideoFunnelRow } from "@/lib/services/youtube-attribution-rollup";

describe("YouTubeVideoTable rate grading", () => {
  const video = (
    utmCampaign: string,
    visits: number,
    leads: number,
    visitToLeadPct: number | null,
  ): YouTubeVideoFunnelRow => ({
    utmCampaign,
    title: utmCampaign,
    videoUrl: null,
    publishedAt: null,
    inRegistry: true,
    clicks: null,
    visits,
    leads,
    qualified: 0,
    booked: 0,
    attended: 0,
    closed: 0,
    visitToLeadPct,
    // PR #28 deletes this field; drop it here when that lands.
    clickToLeadPct: null,
    leadToBookedPct: null,
    bookedToClosedPct: null,
    avgDaysToClose: null,
  });

  const table = (rows: YouTubeVideoFunnelRow[]) =>
    renderToStaticMarkup(
      <YouTubeVideoTable rows={rows} sortHref={() => "#"} activeSort="leads" />,
    );

  it("tints the standouts and says in words what the tint means", () => {
    const html = table([
      video("a", 100, 10, 10),
      video("b", 100, 10, 10),
      video("c", 100, 20, 20),
      video("d", 100, 4, 4),
    ]);

    expect(html).toContain("bg-ui-ok-fill");
    expect(html).toContain("bg-ui-bad-fill");
    // Never colour alone: an arrow for sighted readers, a sentence for the
    // rest, and a legend that says what it is measured against.
    expect(html).toContain("Above median");
    expect(html).toContain("above the median for this range");
    expect(html).toContain("not graded");
  });

  it("leaves a rate built on too few rows uncoloured", () => {
    const html = table([
      video("a", 100, 10, 10),
      video("b", 100, 10, 10),
      video("c", 100, 20, 20),
      // 100% off two visits is not a result, and green here would send
      // somebody off to make more videos like it.
      video("tiny", 2, 2, 100),
    ]);

    // Still shown -- as a plain cell, with no chip wrapped round it.
    expect(html).toContain('tabular-nums">100%</td>');
    // Three videos are comparable, so three chips, and the outlier is not one.
    expect(html.match(/rounded-ui inline-flex w-fit/g)).toHaveLength(3);
  });
});
