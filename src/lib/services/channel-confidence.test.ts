import { describe, expect, it } from "vitest";
import { buildConfidence } from "./channel-confidence";
import type { ChannelFact } from "./channel-report-rollup";

function fact(overrides: Partial<ChannelFact>): ChannelFact {
  return {
    day: "2026-09-10",
    channel: "Instagram",
    source: "instagram",
    medium: "organic",
    campaign: "bio",
    content: "profile",
    destination: "book-call",
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    visits: null,
    leads: null,
    booked: null,
    showed: null,
    won: null,
    revenue: null,
    ...overrides,
  };
}

const sources = {
  leadSubmissions: 10,
  webinarRegistrations: null,
  ga4Sessions: 100,
  calendlyBookings: 4,
};

describe("buildConfidence", () => {
  it("prints both numbers for every reconciliation and excludes program bookings", () => {
    const report = buildConfidence(
      [
        fact({ visits: 100, leads: 10, booked: 3 }),
        fact({ channel: "Webinar", source: "webinar", leads: 500, booked: 40 }),
        fact({ channel: "Instagram DM", source: "manychat", booked: 2 }),
      ],
      [],
      sources,
    );
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId.leads).toMatchObject({ status: "ok" });
    expect(byId.leads.detail).toContain("Spine 10 vs lead_submissions 10");
    expect(byId.booked.detail).toContain(
      "Spine 3 vs calendly_bookings (booked, linked or tagged) 4",
    );
    expect(byId.webinar).toMatchObject({ status: "info" });
    expect(byId.placeholder).toMatchObject({ status: "ok" });
  });

  it("flags bookings from a placeholder-tagged link", () => {
    const report = buildConfidence(
      [fact({ channel: "Unknown", source: "_____", booked: 7, visits: 20 })],
      [],
      sources,
    );
    const check = report.checks.find((c) => c.id === "placeholder");
    expect(check).toMatchObject({ status: "warn" });
    expect(check?.detail).toContain(
      '7 bookings and 0 leads came from links tagged "_____"',
    );
  });

  it("names the unhealthy connector behind a coverage gap", () => {
    const report = buildConfidence(
      [fact({ channel: "YouTube", source: "youtube", visits: 5 })],
      [
        {
          connector: "youtube-analytics",
          status: "skipped",
          lastRunAt: null,
          rowsWritten: 0,
          error: null,
        } as never,
      ],
      sources,
    );
    const youtube = report.coverage.find((row) => row.channel === "YouTube");
    expect(youtube?.cells.impressions).toMatchObject({
      expected: true,
      observed: false,
    });
    expect(youtube?.cells.impressions.cause).toContain("youtube-analytics");
  });
});
