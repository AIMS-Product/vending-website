import { describe, expect, it } from "vitest";
import {
  buildChannelReport,
  summariseSyncRuns,
  sumObserved,
  type ChannelFact,
} from "./channel-report-rollup";

function fact(overrides: Partial<ChannelFact>): ChannelFact {
  return {
    day: "2026-09-10",
    channel: "Instagram",
    source: "instagram",
    medium: "organic",
    campaign: "webinar-sept15",
    content: "reel",
    destination: "webinar-register",
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

describe("sumObserved", () => {
  it("is null when nothing was observed and a number otherwise", () => {
    expect(sumObserved([null, undefined])).toBeNull();
    expect(sumObserved([null, 3, 0])).toBe(3);
  });
});

describe("buildChannelReport", () => {
  it("builds the funnel from totals with each stage over the nearest observed one above", () => {
    const report = buildChannelReport(
      [
        fact({ clicks: 100, visits: 80 }),
        fact({ leads: 20, booked: 5, showed: 4, won: 1 }),
      ],
      [fact({ clicks: 50, leads: 10 })],
    );

    const byKey = Object.fromEntries(
      report.funnel.map((stage) => [stage.key, stage]),
    );
    expect(byKey.impressions.value).toBeNull();
    expect(byKey.clicks).toMatchObject({
      value: 100,
      prior: 50,
      ofPreviousPct: null,
      deltaPct: 100,
    });
    expect(byKey.visits.ofPreviousPct).toBe(80);
    expect(byKey.leads).toMatchObject({ value: 20, ofPreviousPct: 25 });
    expect(byKey.booked.ofPreviousPct).toBe(25);
    expect(byKey.won.ofPreviousPct).toBe(25);
  });

  it("rolls rows up by channel with rates and cost per lead, ordered by leads", () => {
    const report = buildChannelReport(
      [
        fact({ channel: "Instagram", visits: 200, leads: 10, booked: 2 }),
        fact({
          channel: "Meta Ads",
          source: "meta_ads",
          spend: 500,
          visits: 400,
          leads: 25,
          booked: 5,
          won: 1,
        }),
        fact({ channel: "TikTok", source: "tiktok", impressions: 9000 }),
      ],
      [fact({ channel: "Instagram", leads: 5 })],
    );

    expect(report.rows.map((row) => row.label)).toEqual([
      "Meta Ads",
      "Instagram",
      "TikTok",
    ]);
    const meta = report.rows[0];
    expect(meta.rates).toEqual({ leadPct: 6.3, bookPct: 20, winPct: 20 });
    expect(meta.costPerLead).toBe(20);
    expect(meta.costPerBooked).toBe(100);
    const instagram = report.rows[1];
    expect(instagram.prior.leads).toBe(5);
    expect(instagram.costPerLead).toBeNull();
    expect(instagram.rates.winPct).toBeNull();
    // A channel with only impressions still appears.
    expect(report.rows[2].metrics.impressions).toBe(9000);
  });

  it("can group by destination for the drill-in", () => {
    const report = buildChannelReport(
      [
        fact({ destination: "book-call", leads: 3 }),
        fact({ destination: "unknown", leads: 1 }),
      ],
      [],
      "destination",
    );
    expect(report.rows.map((row) => [row.label, row.metrics.leads])).toEqual([
      ["book-call", 3],
      ["unknown", 1],
    ]);
  });
});

describe("summariseSyncRuns", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");

  it("judges the latest run per connector and lists expected ones that never ran", () => {
    const rows = summariseSyncRuns(
      [
        {
          connector: "ga4-visits",
          started_at: "2026-09-11T11:10:00.000Z",
          finished_at: "2026-09-11T11:10:05.000Z",
          rows_written: 120,
          error: null,
        },
        {
          connector: "ga4-visits",
          started_at: "2026-09-10T11:10:00.000Z",
          finished_at: "2026-09-10T11:10:05.000Z",
          rows_written: 0,
          error: "Error: old failure",
        },
        {
          connector: "bitly-clicks",
          started_at: "2026-09-11T11:10:06.000Z",
          finished_at: "2026-09-11T11:10:09.000Z",
          rows_written: 0,
          error: "Error: HTTP 429",
        },
        {
          connector: "leads",
          started_at: "2026-09-09T11:10:00.000Z",
          finished_at: "2026-09-09T11:10:01.000Z",
          rows_written: 40,
          error: null,
        },
        {
          connector: "metricool",
          started_at: "2026-09-11T11:00:00.000Z",
          finished_at: "2026-09-11T11:00:01.000Z",
          rows_written: 0,
          error: "skipped: METRICOOL_API_KEY is not set.",
        },
      ],
      ["ga4-visits", "bitly-clicks", "leads", "webinar-ingest"],
      now,
    );

    expect(rows.map((row) => [row.connector, row.status])).toEqual([
      ["ga4-visits", "ok"],
      ["bitly-clicks", "failed"],
      ["leads", "stale"],
      ["webinar-ingest", "never"],
      ["metricool", "skipped"],
    ]);
    expect(rows[4].note).toBe("METRICOOL_API_KEY is not set.");
  });
});
