import { describe, expect, it } from "vitest";
import type { CloseCall } from "@/lib/services/close-week-view";
import { buildChannelFlow, type FlowWin } from "./channel-flow";
import {
  buildChannelValue,
  focusLines,
  metaCampaigns,
  paidByNetwork,
  spendByFlowChannel,
  type ChannelValueRow,
} from "./channel-value";

const calls = (funnel: string, n: number, showed = 0): CloseCall[] =>
  Array.from({ length: n }, (_, i) => ({
    leadId: `${funnel}-${i}`,
    funnel,
    status: "Lead",
    bookedDate: "2026-09-10",
    showUp: i < showed ? "Yes" : null,
    qualified: null,
  }));

const window = { startDay: "2026-09-01", endDay: "2026-09-30" };

function build() {
  const allCalls = [
    ...calls("Google Ads", 20, 10),
    ...calls("Internal Webinar", 12, 9),
    ...calls("YouTube", 4, 2),
    ...calls("Sales Reactivation", 30, 15).map((c) => ({
      ...c,
      bookedBy: "Lane 2",
    })),
    ...calls("Not a funnel", 1),
  ];
  const wins: FlowWin[] = [
    { leadId: "Google Ads-0", value: 5000 },
    { leadId: "Internal Webinar-0", value: 6000 },
    { leadId: "Internal Webinar-1", value: 6000 },
    { leadId: "Internal Webinar-2", value: null },
    { leadId: "YouTube-0", value: 4000 },
  ];
  const flow = buildChannelFlow({ calls: allCalls, captured: [], wins });
  const spend = spendByFlowChannel(
    [
      { day: "2026-09-02", channel: "Google Ads", spend: 2000 },
      { day: "2026-08-31", channel: "Google Ads", spend: 999 }, // outside
      { day: "2026-09-03", channel: "Webinar", spend: 3000 },
      { day: "2026-09-03", channel: "Meta Ads", spend: 500 }, // no calls
      { day: "2026-09-03", channel: "YouTube", spend: 0 }, // unobserved
      { day: "2026-09-03", channel: "Instagram", spend: null },
    ],
    window,
  );
  return { flow, spend, rows: buildChannelValue(flow, spend) };
}

const row = (rows: ChannelValueRow[], key: string) =>
  rows.find((r) => r.key === key)!;

describe("channel value", () => {
  it("sums spend per flow channel inside the window only", () => {
    const { spend } = build();
    expect(Object.fromEntries(spend)).toEqual({
      "google-ads": 2000,
      webinar: 3000,
      "meta-ads": 500,
    });
  });

  it("leaves every cost column empty for a channel with no paid spend", () => {
    const yt = row(build().rows, "youtube");
    expect(yt.spend).toBeNull();
    expect(yt.costPerBooked).toBeNull();
    expect(yt.costPerWon).toBeNull();
    expect(yt.revenuePerDollar).toBeNull();
    expect(yt.closeRate).toBe(25);
  });

  it("never divides by zero", () => {
    const meta = row(build().rows, "meta-ads");
    expect(meta).toMatchObject({ spend: 500, booked: 0, won: 0 });
    expect(meta.showRate).toBeNull();
    expect(meta.closeRate).toBeNull();
    expect(meta.costPerBooked).toBeNull();
    expect(meta.costPerWon).toBeNull();
    expect(meta.revenuePerDollar).toBe(0);
  });

  it("prices paid channels over the flow's own counts", () => {
    const { rows } = build();
    expect(row(rows, "google-ads")).toMatchObject({
      spend: 2000,
      booked: 20,
      showRate: 50,
      closeRate: 5,
      costPerBooked: 100,
      costPerWon: 2000,
      revenuePerDollar: 2.5,
      smallSample: false,
    });
    expect(row(rows, "webinar")).toMatchObject({
      won: 3,
      revenue: 12000,
      costPerWon: 1000,
      revenuePerDollar: 4,
    });
  });

  it("flags rows under ten booked calls as a small sample", () => {
    const { rows } = build();
    expect(row(rows, "youtube").smallSample).toBe(true);
    expect(row(rows, "meta-ads").smallSample).toBe(true);
    expect(row(rows, "webinar").smallSample).toBe(false);
  });

  it("sorts paid channels by return, then the rest, other last", () => {
    expect(build().rows.map((r) => r.key)).toEqual([
      "webinar",
      "google-ads",
      "meta-ads",
      "youtube",
      "reactivation",
      "other",
    ]);
  });

  it("never moves a call to Google Ads on a click id (Dom's rule)", () => {
    const allCalls = [
      ...calls("Google Ads", 2),
      ...calls("Sales Reactivation", 3).map((c) => ({
        ...c,
        bookedBy: "Lane 2",
      })),
    ];
    const flow = buildChannelFlow({ calls: allCalls, captured: [], wins: [] });
    const band = (key: string) => flow.bands.find((b) => b.key === key)!;
    expect(band("google-ads").values[1]).toBe(2);
    expect(band("reactivation").values[1]).toBe(3);
    expect(flow.totals[1]).toBe(5);
  });

  it("carries booked, won and revenue straight from the flow", () => {
    const { flow, rows } = build();
    for (const band of flow.bands) {
      const r = row(rows, band.key);
      expect([r.booked, r.showed, r.won, r.revenue]).toEqual([
        band.values[1],
        band.values[2],
        band.values[4],
        band.revenue,
      ]);
    }
    const sum = (k: "booked" | "won" | "revenue") =>
      rows.reduce((s, r) => s + r[k], 0);
    expect([sum("booked"), sum("won"), sum("revenue")]).toEqual([
      flow.totals[1],
      flow.totals[4],
      flow.revenue,
    ]);
  });
});

const valueRow = (
  label: string,
  revenuePerDollar: number | null,
  over: Partial<ChannelValueRow> = {},
): ChannelValueRow => ({
  key: "other",
  label,
  spend: 1000,
  booked: 20,
  showed: 10,
  won: 2,
  revenue: 0,
  showRate: 50,
  closeRate: 10,
  costPerBooked: 50,
  costPerWon: 500,
  revenuePerDollar,
  smallSample: false,
  ...over,
});

describe("focusLines", () => {
  it("doubles down on the best returns, watches the worst, at most three", () => {
    const lines = focusLines([
      valueRow("A", 4),
      valueRow("B", 2),
      valueRow("C", 1.5),
      valueRow("D", 0.5),
      valueRow("E", 0.2),
    ]);
    expect(lines.map((l) => [l.tone, l.label])).toEqual([
      ["double-down", "A"],
      ["double-down", "B"],
      ["watch", "E"],
    ]);
  });

  it("skips small samples, unpaid channels and channels with no return figure", () => {
    const lines = focusLines([
      valueRow("Small", 9, { smallSample: true }),
      valueRow("Unpaid", null, { spend: null }),
      valueRow("Nothing", null),
      valueRow("Kept", 0.9),
    ]);
    expect(lines.map((l) => l.label)).toEqual(["Kept"]);
  });

  it("uses all three lines for doubles when nothing needs watching", () => {
    expect(
      focusLines([
        valueRow("A", 3),
        valueRow("B", 2),
        valueRow("C", 1),
        valueRow("D", 1),
      ]),
    ).toHaveLength(3);
  });
});

describe("paid ads", () => {
  const range = { startDay: "2026-10-01", endDay: "2026-10-10" };
  const facts = [
    {
      day: "2026-10-02",
      source: "google",
      content: "W2",
      spend: 600,
      clicks: 300,
    },
    { day: "2026-10-02", source: "google", leads: 12 },
    {
      day: "2026-10-03",
      source: "meta_ads",
      content: "Webinar Oct 13",
      spend: 900.4,
      clicks: 1000,
    },
    {
      day: "2026-10-04",
      source: "meta_ads",
      content: "Webinar Oct 13",
      spend: 100,
      clicks: 50,
    },
    {
      day: "2026-10-04",
      source: "meta_ads",
      content: "VSL",
      spend: 50,
      clicks: 10,
    },
    { day: "2026-10-04", source: "meta_ads", contacts: 400 },
    // Outside the range: never counted.
    {
      day: "2026-09-30",
      source: "meta_ads",
      content: "VSL",
      spend: 999,
      clicks: 9,
    },
  ];
  const flow = buildChannelFlow({
    calls: [
      ...calls("Google Ads", 6),
      ...calls("Internal Webinar", 20),
      ...calls("Meta Ads", 5),
    ],
    captured: [],
    wins: [{ leadId: "Internal Webinar-0", value: 5000 }],
  });

  it("puts Google and Meta side by side, Meta owning the webinar calls", () => {
    expect(paidByNetwork(facts, flow, range)).toEqual([
      {
        key: "google",
        label: "Google Ads",
        spend: 600,
        clicks: 300,
        signUps: 12,
        booked: 6,
        won: 0,
        costPerBooked: 100,
      },
      {
        key: "meta",
        label: "Meta",
        spend: 1050,
        clicks: 1060,
        signUps: 400,
        booked: 25,
        won: 1,
        costPerBooked: 42,
      },
    ]);
  });

  it("splits Meta spend and clicks by campaign name, nothing it cannot split", () => {
    expect(
      metaCampaigns(facts, range).map((r) => [
        r.label,
        r.spend,
        r.clicks,
        r.signUps,
      ]),
    ).toEqual([
      ["Webinar Oct 13", 1000, 1050, null],
      ["VSL", 50, 10, null],
    ]);
  });
});
