import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  YouTubeCoverageNote,
  YouTubeStageFunnel,
} from "./YouTubeAttributionPanels";
import type { YouTubeCoverage } from "@/lib/services/youtube-attribution-rollup";

const RANGE = {
  key: "90d" as const,
  label: "Last 90 days",
  days: 90,
  startIso: "2026-06-12T00:00:00.000Z",
  endIso: "2026-09-10T00:00:00.000Z",
};

function coverage(overrides: Partial<YouTubeCoverage> = {}): YouTubeCoverage {
  return {
    registryVideos: 42,
    videosWithLeads: 12,
    campaignsMissingFromRegistry: [],
    clicksConnected: true,
    clicksWindowStart: null,
    visitsConnected: true,
    visitsSource: "ga4",
    outcomesConnected: true,
    bookedBeforeLead: 0,
    ...overrides,
  };
}

function note(overrides: Partial<YouTubeCoverage> = {}) {
  return renderToStaticMarkup(
    <YouTubeCoverageNote coverage={coverage(overrides)} range={RANGE} />,
  );
}

describe("YouTubeCoverageNote", () => {
  /**
   * M12: the note credited the bookedBeforeLead count with an exclusion that
   * closeDurations does not make. Those two counts are built from different
   * columns — call_booked_at against closed_won_at — so the sentence stated a
   * rule the numbers do not follow.
   */
  it("describes what a booked-before-lead row actually is", () => {
    const html = note({ bookedBeforeLead: 3 });

    expect(html).toContain("3");
    expect(html).toContain("first touch");
    // The false claim: these rows are not the set closeDurations drops.
    expect(html).not.toContain("excluded from cycle times");
  });

  it("names the clicks boundary when the range outruns the synced window", () => {
    const html = note({
      clicksConnected: false,
      clicksWindowStart: "2026-08-20",
    });

    expect(html).toContain("2026-08-20");
    expect(html).not.toContain("need a Bitly token");
  });

  it("still blames the missing token when nothing has ever synced", () => {
    const html = note({ clicksConnected: false, clicksWindowStart: null });

    expect(html).toContain("Bitly token");
  });

  it("says which wins are left out of the cycle-time figures", () => {
    const html = note({ bookedBeforeLead: 0 });

    expect(html).toContain("Cycle times");
  });
});

describe("YouTubeStageFunnel", () => {
  it("does not call a measured zero denominator 'not connected'", () => {
    const html = renderToStaticMarkup(
      <YouTubeStageFunnel
        stages={[
          { label: "Link clicks", count: 0, ofPreviousPct: null },
          { label: "Landing page visits", count: 233, ofPreviousPct: null },
        ]}
      />,
    );

    expect(html).not.toContain("Not connected yet");
    expect(html).toContain("Nothing to divide by");
  });

  it("still says not measured when a stage could not be read", () => {
    const html = renderToStaticMarkup(
      <YouTubeStageFunnel
        stages={[
          { label: "Link clicks", count: null, ofPreviousPct: null },
          { label: "Landing page visits", count: 233, ofPreviousPct: null },
        ]}
      />,
    );

    expect(html).toContain("Not measured yet");
  });
});
