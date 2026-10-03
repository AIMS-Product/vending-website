import { describe, expect, it } from "vitest";
import type { ChannelFact } from "@/lib/services/channel-report-rollup";
import type { CloseCall } from "@/lib/services/close-week-view";
import {
  NO_SETTER,
  bySetter,
  capturedByChannel,
  costPerBookedByMonth,
  dailyCounts,
  deltaPct,
  monthKeys,
  planBooked,
  showRateHeld,
  sparkPoints,
  windowPlanTarget,
} from "./dashboard-metrics";

const call = (over: Partial<CloseCall> & { leadId: string }): CloseCall => ({
  funnel: "YouTube",
  status: "Lead",
  bookedDate: "2026-10-01",
  showUp: null,
  qualified: null,
  ...over,
});

const fact = (over: Partial<ChannelFact>): ChannelFact =>
  ({
    day: "2026-09-01",
    channel: "Google Ads",
    source: "google",
    medium: "cpc",
    campaign: "(not set)",
    content: "(not set)",
    destination: "(not set)",
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    visits: null,
    thankyou_visits: null,
    leads: null,
    contacts: null,
    booked: null,
    showed: null,
    won: null,
    revenue: null,
    ...over,
  }) as ChannelFact;

describe("dashboard metrics", () => {
  it("leaves calls that have not happened yet out of the show rate", () => {
    const range = { startDay: "2026-10-01", endDay: "2026-10-02" };
    const result = showRateHeld(
      [
        call({ leadId: "a", showUp: "Yes" }),
        call({ leadId: "b", showUp: "No" }),
        call({ leadId: "c", bookedDate: "2026-10-02" }),
        call({ leadId: "d", status: "Outside the US", showUp: "Yes" }),
      ],
      range,
      "2026-10-02",
    );
    expect(result).toEqual({ showed: 1, held: 2, rate: 50 });
    expect(showRateHeld([], range, "2026-10-02").rate).toBeNull();
  });

  it("fills every day of the range, zeros included", () => {
    const series = dailyCounts(
      ["2026-10-01", "2026-10-01", "2026-09-01"],
      (d) => d,
      { startDay: "2026-09-30", endDay: "2026-10-01" },
    );
    expect(series).toEqual([
      { day: "2026-09-30", value: 0 },
      { day: "2026-10-01", value: 2 },
    ]);
  });

  it("has no delta without a base", () => {
    expect(deltaPct(10, 0)).toBeNull();
    expect(deltaPct(null, 4)).toBeNull();
    expect(deltaPct(15, 10)).toBe(50);
  });

  it("sums long series into weeks", () => {
    expect(
      sparkPoints(Array.from({ length: 14 }, () => ({ value: 1 }))),
    ).toHaveLength(14);
    expect(
      sparkPoints(Array.from({ length: 91 }, () => ({ value: 1 }))),
    ).toEqual([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
  });

  it("prorates the plan by the window's days in each month", () => {
    // October's plan totals 676 (AGENTS.md); half of the month's days is half.
    expect(
      windowPlanTarget({ startDay: "2026-10-01", endDay: "2026-10-31" }),
    ).toBe(676);
    expect(
      windowPlanTarget({ startDay: "2026-09-01", endDay: "2026-09-30" }),
    ).toBe(619);
    expect(
      windowPlanTarget({ startDay: "2026-08-01", endDay: "2026-08-31" }),
    ).toBeNull();
  });

  it("counts plan actuals with cancellations and without unplanned funnels", () => {
    const range = { startDay: "2026-10-01", endDay: "2026-10-31" };
    expect(
      planBooked(
        [
          call({ leadId: "a", status: "Canceled (by Lead)" }),
          call({ leadId: "b", funnel: "Google Ads" }),
          call({ leadId: "c", funnel: "Reactivation Scrapers" }),
        ],
        range,
      ),
    ).toBe(2);
  });

  it("counts plan actuals only in months the plan covers", () => {
    const q3 = { startDay: "2026-07-01", endDay: "2026-09-30" };
    expect(windowPlanTarget(q3)).toBe(619);
    expect(
      planBooked(
        [
          call({ leadId: "a", bookedDate: "2026-07-15" }),
          call({ leadId: "b", bookedDate: "2026-08-15" }),
          call({ leadId: "c", bookedDate: "2026-09-15" }),
        ],
        q3,
      ),
    ).toBe(1);
  });

  it("puts calls with no setter last", () => {
    const rows = bySetter([
      { ...call({ leadId: "a" }), setter: null },
      { ...call({ leadId: "b" }), setter: null },
      { ...call({ leadId: "c" }), setter: "Connor George" },
    ]);
    expect(rows).toEqual([
      { label: "Connor George", value: 1 },
      { label: NO_SETTER, value: 2 },
    ]);
  });

  it("captures leads and contacts by channel", () => {
    expect(
      capturedByChannel(
        [
          fact({ channel: "Webinar", contacts: 40, leads: null }),
          fact({ channel: "Webinar", leads: 2 }),
          fact({ channel: "Webinar", day: "2026-08-01", leads: 9 }),
        ],
        { startDay: "2026-09-01", endDay: "2026-09-30" },
      ),
    ).toEqual([{ channel: "Webinar", count: 42 }]);
  });

  it("prices booked calls per channel per month, null with no bookings", () => {
    const months = monthKeys("2026-08-15", "2026-09-02");
    expect(months).toEqual(["2026-08", "2026-09"]);
    const rows = costPerBookedByMonth(
      [
        fact({ day: "2026-08-03", spend: 1000, booked: 4 }),
        fact({ day: "2026-09-03", spend: 500 }),
        fact({ day: "2026-09-03", channel: "Meta Ads", spend: 300, booked: 3 }),
        fact({ day: "2026-09-03", channel: "YouTube", booked: 9 }),
      ],
      months,
    );
    expect(rows.map((r) => r.key)).toEqual([
      "google-ads",
      "meta-ads",
      "blended",
    ]);
    expect(rows[0]!.months.map((m) => m.cost)).toEqual([250, null]);
    expect(rows[2]!.months[1]).toEqual({
      month: "2026-09",
      spend: 800,
      booked: 3,
      cost: 267,
    });
  });
});
