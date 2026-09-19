import { describe, expect, it } from "vitest";
import {
  buildChannelReport,
  buildGoingOut,
  ofObservedPct,
  ofVisitsPct,
  summariseSyncRuns,
  sumObserved,
  type ChannelFact,
  type GoingOutLink,
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
    thankyou_visits: null,
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
  it("splits reach from the site funnel and pairs each share on one population", () => {
    const report = buildChannelReport(
      [
        fact({ clicks: 100, visits: 80 }),
        fact({ leads: 20, booked: 5, showed: 4, won: 1 }),
      ],
      [fact({ clicks: 50, leads: 10 })],
    );

    const reach = Object.fromEntries(
      report.reach.map((stage) => [stage.key, stage]),
    );
    expect(reach.impressions.value).toBeNull();
    expect(reach.clicks).toMatchObject({
      value: 100,
      prior: 50,
      ofPreviousPct: null,
      deltaPct: 100,
    });

    const funnel = Object.fromEntries(
      report.funnel.map((stage) => [stage.key, stage]),
    );
    expect(funnel.clicks).toBeUndefined();
    expect(funnel.visits).toMatchObject({ value: 80, ofPreviousPct: null });
    // No row observed both visits and leads, so the share is null, not 25%.
    expect(funnel.leads).toMatchObject({
      value: 20,
      ofPreviousPct: null,
      ofPreviousLabel: "Visited",
    });
    expect(funnel.booked.ofPreviousPct).toBe(25);
    expect(funnel.won.ofPreviousPct).toBe(25);
  });

  it("keeps bookings without a lead out of Book % and collapses visit-only rows", () => {
    const report = buildChannelReport(
      [
        fact({ visits: 100, leads: 10, booked: 2 }),
        fact({ visits: 50, booked: 3 }),
        fact({ channel: "Referral", source: "example.com", visits: 7 }),
      ],
      [],
    );
    expect(report.rows.map((row) => row.label)).toEqual(["Instagram"]);
    expect(report.rows[0].rates.bookPct).toBe(20);
    expect(report.rows[0].directBooked).toBe(3);
    expect(report.tail.map((row) => row.label)).toEqual(["Referral"]);
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

  it("prices spend per sign-up where it mostly bought registrations", () => {
    // August 2026 in production: $40,128 of webinar ads over 8 site leads
    // printed a $5,016 cost per lead; the 2,727 registrations it bought were
    // about $15 each.
    const report = buildChannelReport(
      [
        fact({
          channel: "Webinar",
          source: "meta_ads",
          spend: 40128,
          leads: 8,
          contacts: 2727,
        }),
        fact({
          channel: "Google Ads",
          source: "google",
          spend: 1100,
          leads: 10,
        }),
      ],
      [],
    );
    const webinar = report.rows.find((row) => row.label === "Webinar")!;
    expect(webinar.costPerLead).toBe(5016);
    expect(webinar.costPerSignup).toBe(14.7);
    const google = report.rows.find((row) => row.label === "Google Ads")!;
    expect(google.costPerSignup).toBeNull();
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

describe("buildGoingOut", () => {
  const link = (overrides: Partial<GoingOutLink>): GoingOutLink => ({
    id: "l1",
    url: "https://www.vendingpreneurs.com/book?utm_source=instagram",
    label: null,
    utm_source: "instagram",
    utm_medium: "organic",
    utm_campaign: "webinar-sept15",
    utm_content: "post-1",
    utm_term: "webinar-register",
    bitly_id: "bit.ly/abc",
    bitly_url: "https://bit.ly/abc",
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  });

  it("keeps zero-click links, nulls links without a short link, and splits prior", () => {
    const rows = buildGoingOut(
      [
        link({ id: "hot", bitly_id: "bit.ly/hot" }),
        link({ id: "cold", bitly_id: "bit.ly/cold" }),
        link({ id: "long", bitly_id: null, bitly_url: null }),
      ],
      [
        { bitly_id: "bit.ly/hot", day: "2026-09-10", clicks: 4 },
        { bitly_id: "bit.ly/hot", day: "2026-09-09", clicks: 1 },
        { bitly_id: "bit.ly/hot", day: "2026-09-01", clicks: 7 },
      ],
      "2026-09-05",
    );
    expect(rows.map((row) => [row.id, row.clicks, row.priorClicks])).toEqual([
      ["hot", 5, 7],
      ["cold", 0, 0],
      ["long", null, null],
    ]);
  });
});

describe("ofObservedPct", () => {
  it("counts a lead-day that booked nobody, instead of averaging over booking days only", () => {
    const facts = [
      fact({ leads: 50, booked: 5 }),
      fact({ day: "2026-09-02", leads: 150, booked: null }),
    ];
    // The bug this replaced: "both observed" dropped the second row and gave
    // 5 / 50 = 10%. Over 200 leads the real rate is 2.5%.
    expect(ofObservedPct(facts, "booked", "leads")).toBe(2.5);
  });

  it("reproduces the Webinar 140% and settles it", () => {
    // 2026-09-18 production, 30 days: 4,042 Webinar leads are registrations
    // written by the webinar receiver on rows that carry no booking, and the
    // 152 bookings sit on a handful of /start rows that carry a few leads.
    // Pairing the two divided 152 by that handful.
    const facts = [
      fact({ channel: "Webinar", leads: 3934, booked: null }),
      fact({ day: "2026-09-02", channel: "Webinar", leads: 108, booked: 152 }),
    ];
    expect(ofObservedPct(facts, "booked", "leads")).toBe(3.8);
    // What the old pairedPct did: 152 / 108.
    expect(Math.round((152 / 108) * 100)).toBe(141);
  });

  it("keeps the rate when it is honestly above 100%", () => {
    // A booking today can belong to a lead captured last week. Both sides are
    // still our own tables, so the number stands rather than becoming a dash.
    expect(
      ofObservedPct([fact({ leads: 10, booked: 11 })], "booked", "leads"),
    ).toBe(110);
  });

  it("is null when the denominator was never observed", () => {
    expect(
      ofObservedPct([fact({ leads: null, booked: 4 })], "booked", "leads"),
    ).toBeNull();
  });
});

describe("ofVisitsPct", () => {
  it("counts a visit-day that converted nobody, instead of averaging over converting days only", () => {
    const facts = [
      fact({ visits: 1000, leads: 200 }),
      fact({ day: "2026-09-02", visits: 500, leads: null }),
    ];
    // The bug this replaced: dropping the second row gave 200 / 1000 = 20%,
    // which is how the KPI tab came to show YouTube at 35.3% against a true
    // 11.7% on 2026-09-11.
    expect(ofVisitsPct(facts, "leads")).toBe(13.3);
  });

  it("is null when visits and leads never share a row", () => {
    // The chatbot: leads are captured mid-conversation, with no landing
    // session on the same link and day. There is no rate to state.
    expect(
      ofVisitsPct(
        [
          fact({ visits: 17, leads: null }),
          fact({ day: "2026-09-02", visits: null, leads: 40 }),
        ],
        "leads",
      ),
    ).toBeNull();
  });

  it("is null, not zero, when the numerator was never observed", () => {
    // Organic search: visits and no lead ever tagged with it. And every
    // metric before its connector has run for the first time -- a 0% there
    // would only mean nobody has measured yet.
    expect(
      ofVisitsPct([fact({ visits: 1217, leads: null })], "leads"),
    ).toBeNull();
  });

  it("refuses the rate when the visit rows cover under half the leads", () => {
    // Google Ads before the campaign-id backfill: GA4 keyed visits on the
    // campaign name, the links carried the numeric id, so 116 of 128 leads
    // never shared a row with a visit. 12 / 5495 = 0.2% against a true 2.3%.
    const facts = [
      fact({ channel: "Google Ads", campaign: "VP | Brand", visits: 5443 }),
      fact({
        channel: "Google Ads",
        campaign: "23805931083",
        visits: 52,
        leads: 12,
      }),
      fact({
        channel: "Google Ads",
        campaign: "23805931083",
        day: "2026-09-02",
        leads: 116,
      }),
    ];
    expect(ofVisitsPct(facts, "leads")).toBeNull();
  });

  it("states the rate once most of the leads are covered", () => {
    // YouTube: 140 of 154 leads land on a row that also saw visits.
    const facts = [
      fact({ visits: 1320, leads: 140 }),
      fact({ day: "2026-09-02", leads: 14 }),
    ];
    expect(ofVisitsPct(facts, "leads")).toBe(10.6);
  });

  it("is null when nothing observed visits", () => {
    expect(
      ofVisitsPct([fact({ visits: null, leads: 75 })], "leads"),
    ).toBeNull();
  });
});
