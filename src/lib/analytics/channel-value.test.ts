import { describe, expect, it } from "vitest";
import type { CloseCall } from "@/lib/services/close-week-view";
import { buildChannelFlow, type FlowWin } from "./channel-flow";
import {
  buildChannelValue,
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
    ...calls("Sales Reactivation", 30, 15),
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
