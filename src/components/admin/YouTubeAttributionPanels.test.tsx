import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YouTubeCoverageNote } from "./YouTubeAttributionPanels";
import type { YouTubeAttribution } from "@/lib/services/youtube-attribution";
import type { YouTubeCoverage } from "@/lib/services/youtube-attribution-rollup";

const RANGE: YouTubeAttribution["range"] = {
  key: "90d",
  label: "Last 90 days",
  days: 90,
  startIso: "2026-06-12T12:00:00.000Z",
  endIso: "2026-09-10T12:00:00.000Z",
};

function coverage(overrides: Partial<YouTubeCoverage> = {}): YouTubeCoverage {
  return {
    registryVideos: 647,
    videosWithLeads: 40,
    campaignsMissingFromRegistry: [],
    clicksConnected: false,
    clicksWindowStart: null,
    clicksFailed: false,
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

describe("YouTubeCoverageNote, link clicks", () => {
  it("asks for Bitly only when nothing has ever synced", () => {
    expect(note()).toContain("Link clicks appear once Bitly is connected.");
  });

  it("names how far back clicks go when the range reaches past it", () => {
    const html = note({ clicksWindowStart: "2026-08-20" });

    expect(html).toContain("only go back to 2026-08-20");
    expect(html).toContain("last 90 days");
    expect(html).not.toContain("once Bitly is connected");
  });

  it("never sends someone to connect Bitly when the read just failed", () => {
    const html = note({ clicksFailed: true });

    expect(html).toContain("could not be read just now");
    expect(html).not.toContain("once Bitly is connected");
  });
});
