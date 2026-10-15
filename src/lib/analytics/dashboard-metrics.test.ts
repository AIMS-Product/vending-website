import type { Decision } from "@/lib/booked-calls-v2/engine";
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
  firstCallsOn,
  monthKeys,
  planBooked,
  reactivationCalls,
  showRateHeld,
  sparkPoints,
  windowPlanTarget,
  v2DashboardCalls,
  byBooker,
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
  // Dom's rule dates a call by the day it was booked; whether it has been
  // held depends on the day it is scheduled for (`callDay`).
  it("leaves calls that have not happened yet out of the show rate", () => {
    const range = { startDay: "2026-10-01", endDay: "2026-10-02" };
    const result = showRateHeld(
      [
        call({ leadId: "a", showUp: "Yes" }),
        call({ leadId: "b", showUp: "No" }),
        call({ leadId: "c", callDay: "2026-10-02" }),
        call({ leadId: "d", callDay: "2026-10-09", showUp: "Yes" }),
        call({ leadId: "e", status: "Outside the US", showUp: "Yes" }),
      ],
      range,
      "2026-10-02",
    );
    expect(result).toEqual({ showed: 2, held: 3, rate: 66.7 });
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

  it("counts plan actuals by who booked, without unplanned funnels", () => {
    const range = { startDay: "2026-10-01", endDay: "2026-10-31" };
    expect(
      planBooked(
        [
          call({ leadId: "a", status: "Canceled (by Lead)" }),
          call({ leadId: "b", funnel: "Google Ads" }),
          call({ leadId: "c", funnel: "Google Ads", bookedBy: "Lane 2" }),
          // A marketing call from a retired sales funnel is not Lane 2.
          call({
            leadId: "d",
            funnel: "Sales Reactivation",
            bookedBy: "Marketing",
          }),
          call({ leadId: "e", funnel: "Instagram", bookedBy: "Social DMs" }),
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

describe("firstCallsOn", () => {
  it("counts the calls scheduled for the day, once per meeting", () => {
    const calls = [
      call({ leadId: "a", meetingId: "m1" }),
      call({ leadId: "a", meetingId: "m1" }),
      call({ leadId: "b", meetingId: "m2", status: "🔻 Canceled (by Lead)" }),
      call({ leadId: "c", meetingId: "m3", callDay: "2026-10-02" }),
      call({ leadId: "d", meetingId: "m4", bookedDate: "2026-09-28" }),
      call({
        leadId: "e",
        meetingId: "m5",
        bookedDate: "2026-09-28",
        callDay: "2026-10-01",
      }),
    ];
    expect(firstCallsOn(calls, "2026-10-01").map((c) => c.leadId)).toEqual([
      "a",
      "b",
      "e",
    ]);
  });
});

describe("reactivationCalls", () => {
  it("counts calls Lane 2 or Social DMs booked, by the meeting title", () => {
    const kept = [
      call({ leadId: "a", funnel: "YouTube", bookedBy: "Lane 2" }),
      call({ leadId: "b", funnel: "Instagram", bookedBy: "Social DMs" }),
      call({
        leadId: "c",
        funnel: "Sales Reactivation",
        bookedBy: "Marketing",
      }),
      call({ leadId: "y", funnel: "YouTube", bookedBy: "Marketing" }),
    ];
    expect(reactivationCalls(kept)).toBe(2);
  });
});

describe("v2DashboardCalls", () => {
  const decision = (over: Partial<Decision>): Decision =>
    ({
      meetingId: "m1",
      leadId: "lead_a",
      createdDay: "2026-10-03",
      scheduledDay: "2026-10-06",
      disposition: "counted",
      reason: "counted",
      bookedBy: "Marketing",
      mappedSetter: null,
      currentSetter: null,
      caller: "Joe",
      origin: { source: "YouTube", basis: "funnel" },
      offer: null,
      historicalException: null,
      precedingMeetingId: null,
      intervalDays: null,
      ruleVersion: "booked_calls.v2.2",
      ...over,
    }) as Decision;
  const lead = (firstCallDay: string | null) =>
    new Map([
      [
        "lead_a",
        { email: "a@x.test", firstCallDay, showUp: "Yes", qualified: "Yes" },
      ],
    ]);

  it("keeps counted meetings only, dated by the day booked", () => {
    const calls = v2DashboardCalls(
      [
        decision({}),
        decision({
          meetingId: "m2",
          disposition: "excluded",
          reason: "canceled",
        }),
        decision({
          meetingId: "m3",
          disposition: "held",
          reason: "unlinked_reschedule",
        }),
      ],
      lead("2026-10-06"),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      meetingId: "m1",
      bookedDate: "2026-10-03",
      callDay: "2026-10-06",
      funnel: "YouTube",
      bookedBy: "Marketing",
      setter: "Joe",
      showUp: "Yes",
    });
  });

  it("reads Close's first-call show only onto the first call", () => {
    const [later] = v2DashboardCalls([decision({})], lead("2026-08-01"));
    expect(later).toMatchObject({ showUp: null, qualified: null });
  });

  it("leaves an unknown source blank and keeps Lane 2 by booker", () => {
    const [call] = v2DashboardCalls(
      [
        decision({
          bookedBy: "Lane 2",
          origin: { source: null, basis: "unknown" },
        }),
      ],
      new Map(),
    );
    expect(call).toMatchObject({
      funnel: null,
      bookedBy: "Lane 2",
      email: null,
    });
  });
});

describe("byBooker", () => {
  it("files Lane 2 and Social DMs bookings under who booked them, Marketing under its source", () => {
    const base = call({ leadId: "a", funnel: "YouTube" });
    expect(byBooker({ ...base, bookedBy: "Lane 2" }).funnel).toBe("Lane 2");
    expect(byBooker({ ...base, bookedBy: "Social DMs" }).funnel).toBe(
      "Social DMs",
    );
    expect(byBooker({ ...base, bookedBy: "Marketing" }).funnel).toBe("YouTube");
  });
});
