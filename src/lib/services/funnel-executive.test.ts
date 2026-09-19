import { describe, expect, it } from "vitest";
import { buildFunnelExecutive, type SpendRow } from "./funnel-executive";
import type {
  FunnelMonthlyReport,
  FunnelPeriod,
  FunnelPeriodRow,
} from "./funnel-monthly";

function row(overrides: Partial<FunnelPeriodRow> = {}): FunnelPeriodRow {
  return {
    funnel: "YouTube",
    isBookingFunnel: true,
    visits: 1000,
    leads: 50,
    questionsOffered: 0,
    questionsFinished: 0,
    questionsAbandoned: 0,
    booked: 10,
    showable: 8,
    held: 6,
    noShow: 2,
    pendingShow: 0,
    showUnlogged: 0,
    closeable: 6,
    won: 2,
    revenue: 4000,
    rates: {
      visitToLead: 5,
      questionsCompleted: null,
      leadToBook: 20,
      bookToShow: 75,
      showToWin: 33.3,
    } as FunnelPeriodRow["rates"],
    ...overrides,
  };
}

function period(key: string, rows: FunnelPeriodRow[]): FunnelPeriod {
  return {
    key,
    label: key,
    start: `${key}-01`,
    end: `${key}-28`,
    visitsEnd: null,
    visitsStart: null,
    rows,
    totals: row({
      funnel: "All",
      leads: rows.reduce((total, entry) => total + entry.leads, 0),
    }),
  };
}

function report(months: FunnelPeriod[]): FunnelMonthlyReport {
  return {
    months,
    beforeAfter: null,
    visitsThrough: "2026-09-17",
    showCoverage: { known: 1, total: 1, pct: 100 },
    formStartsTracked: false,
    grouping: "channel",
    generatedAt: "2026-09-18T00:00:00.000Z",
  };
}

const spend: SpendRow[] = [
  { day: "2026-08-04", channel: "Google Ads", spend: 600 },
  { day: "2026-08-20", channel: "Google Ads", spend: 400 },
  { day: "2026-08-11", channel: "Meta Ads", spend: 250 },
  // Null spend is "not observed" and must not pull an average down.
  { day: "2026-08-12", channel: "YouTube", spend: null },
  { day: "2026-09-02", channel: "Google Ads", spend: 300 },
];

describe("buildFunnelExecutive", () => {
  const byChannel = report([
    period("2026-09", [row({ funnel: "Google Ads", leads: 30 })]),
    period("2026-08", [
      row({ funnel: "Google Ads", leads: 40 }),
      row({ funnel: "YouTube", leads: 60 }),
    ]),
  ]);
  const byPage = report([
    period("2026-09", [row({ funnel: "/start", leads: 30 })]),
    period("2026-08", [row({ funnel: "/start", leads: 100 })]),
  ]);

  it("divides a month's whole spend by its whole lead cohort", () => {
    const result = buildFunnelExecutive({ byChannel, byPage, spend });
    const august = result.months.find((month) => month.key === "2026-08")!;

    expect(august.spend).toBe(1250);
    expect(august.totals.leads).toBe(100);
    expect(august.costPerLead).toBe(12.5);
  });

  it("leaves webinar ad spend out of cost per site lead", () => {
    // August 2026 in production: $40,128 of webinar ads bought 2,727
    // registrations, and counting it against 510 site leads printed a
    // $117.90 cost per lead where the paid channels ran about $110.
    const result = buildFunnelExecutive({
      byChannel,
      byPage,
      spend: [...spend, { day: "2026-08-15", channel: "Webinar", spend: 9000 }],
    });
    const august = result.months.find((month) => month.key === "2026-08")!;

    expect(august.spend).toBe(1250);
    expect(august.costPerLead).toBe(12.5);
    expect(august.costPerLeadByChannel["Webinar"] ?? null).toBeNull();
    expect(result.spendChannels).toEqual(["Google Ads", "Meta Ads"]);
  });

  it("gives a channel nothing was spent on a dash, not a free lead", () => {
    const result = buildFunnelExecutive({ byChannel, byPage, spend });
    const august = result.months.find((month) => month.key === "2026-08")!;

    expect(august.costPerLeadByChannel["Google Ads"]).toBe(25);
    expect(august.costPerLeadByChannel["YouTube"]).toBeNull();
  });

  it("reports no spend as null rather than zero", () => {
    const result = buildFunnelExecutive({ byChannel, byPage, spend: [] });

    for (const month of result.months) {
      expect(month.spend).toBeNull();
      expect(month.costPerLead).toBeNull();
    }
  });

  it("keeps the month order it was given, most recent first", () => {
    const result = buildFunnelExecutive({ byChannel, byPage, spend });
    expect(result.months.map((month) => month.key)).toEqual([
      "2026-09",
      "2026-08",
    ]);
  });

  it("carries both breakdowns for the same month", () => {
    const result = buildFunnelExecutive({ byChannel, byPage, spend });
    const august = result.months.find((month) => month.key === "2026-08")!;

    expect(august.byChannel.map((entry) => entry.funnel)).toEqual([
      "Google Ads",
      "YouTube",
    ]);
    expect(august.byPage.map((entry) => entry.funnel)).toEqual(["/start"]);
  });

  it("names only the channels spend was actually observed for", () => {
    const result = buildFunnelExecutive({ byChannel, byPage, spend });
    expect(result.spendChannels).toEqual(["Google Ads", "Meta Ads"]);
  });

  it("clips spend to the days the month could capture a lead", () => {
    // The cutover month: capture went live on the 27th, so the four days of
    // spend before it bought traffic that had no form to convert on.
    const cutover = report([
      {
        ...period("2026-08", [row({ funnel: "Google Ads", leads: 40 })]),
        visitsStart: "2026-08-20",
        visitsEnd: "2026-08-28",
      },
    ]);
    const result = buildFunnelExecutive({
      byChannel: cutover,
      byPage: cutover,
      spend,
    });

    // Only the 2026-08-20 Google Ads row falls inside 08-20..08-28.
    expect(result.months[0].spend).toBe(400);
    expect(result.months[0].spendFrom).toBe("2026-08-20");
    expect(result.months[0].costPerLead).toBe(10);
  });

  it("leaves out a month that observed neither a lead nor a visit", () => {
    const withEmpty = report([
      period("2026-09", [row({ funnel: "Google Ads", leads: 30 })]),
      {
        ...period("2026-06", []),
        totals: row({ funnel: "All", leads: 0, visits: null }),
      },
    ]);
    const result = buildFunnelExecutive({
      byChannel: withEmpty,
      byPage: withEmpty,
      spend,
    });

    expect(result.months.map((month) => month.key)).toEqual(["2026-09"]);
  });

  it("returns a dash for a month with spend but no leads", () => {
    const empty = report([period("2026-08", [])]);
    const result = buildFunnelExecutive({
      byChannel: empty,
      byPage: empty,
      spend,
    });

    expect(result.months[0].totals.visits).not.toBeNull();
    expect(result.months[0].spend).toBe(1250);
    expect(result.months[0].costPerLead).toBeNull();
  });
});
