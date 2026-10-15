import { describe, expect, it } from "vitest";
import type { CloseDeal } from "@/lib/services/close-wins";
import {
  buildGoalPlan,
  buildMarketingMtd,
  countChange,
  median,
  priorRange,
  rateChange,
  spendChannel,
  UNKNOWN_CHANNEL,
  type MtdCall,
  type SpendFact,
} from "@/lib/services/marketing-mtd";
import {
  buildScorecard,
  scorecardCsv,
  scorecardWeeks,
  webinarTotals,
} from "@/lib/services/marketing-scorecard";

/** A counted V2 meeting as `v2DashboardCalls` hands it over. */
const call = (over: Partial<MtdCall>): MtdCall => ({
  leadId: `lead_${Math.random()}`,
  funnel: "YouTube",
  status: null,
  bookedDate: "2026-10-05",
  callDay: "2026-10-07",
  showUp: null,
  qualified: null,
  bookedBy: "Marketing",
  ...over,
});
const deal = (over: Partial<CloseDeal>): CloseDeal => ({
  id: `oppo_${Math.random()}`,
  leadId: `lead_${Math.random()}`,
  dateWon: "2026-10-06",
  value: 1000,
  funnel: "YouTube",
  closer: "Joe Dysert",
  closerId: "user_closer",
  leadCreatedAt: "2026-09-28T18:00:00Z",
  ...over,
});
const OCT = { from: "2026-10-01", to: "2026-10-14" };
const build = (input: {
  calls?: MtdCall[];
  deals?: CloseDeal[];
  spend?: SpendFact[];
}) =>
  buildMarketingMtd({
    current: OCT,
    calls: input.calls ?? [],
    deals: input.deals ?? [],
    spend: input.spend ?? [],
  });

describe("buildMarketingMtd on Dom's rule", () => {
  it("counts Marketing calls as booked and Lane 2 on the same source beside them", () => {
    const mtd = build({
      calls: [
        call({}),
        call({ funnel: "Internal Webinar" }),
        call({ funnel: "Internal Webinar", bookedBy: "Lane 2" }),
        call({ funnel: null, bookedBy: "Lane 2" }),
        call({ funnel: "YouTube", bookedBy: "Social DMs" }),
      ],
    });
    expect(mtd.total.current).toMatchObject({ booked: 2, lane2: 2 });
    expect(mtd.socialDms.current).toBe(1);
    expect(
      mtd.rows.map((row) => [row.label, row.current.booked, row.current.lane2]),
    ).toEqual([
      ["Internal Webinar", 1, 1],
      ["YouTube", 1, 0],
      [UNKNOWN_CHANNEL, 0, 1],
    ]);
  });

  it("nests qualified inside shown, lists conflicts, and counts open calls", () => {
    const mtd = build({
      calls: [
        call({ showUp: "Yes", qualified: "Yes" }),
        call({ showUp: "true", qualified: "no" }),
        call({ leadId: "lead_conflict", name: "a@b.co", qualified: "1" }),
        call({ callDay: "2026-10-20" }),
      ],
    });
    expect(mtd.total.current).toMatchObject({
      booked: 4,
      open: 1,
      shown: 2,
      qualified: 1,
    });
    expect(mtd.total.current.conflicts).toEqual([
      { leadId: "lead_conflict", name: "a@b.co" },
    ]);
  });

  it("counts wins on their own, minus excluded closers, by Dom's source label", () => {
    const mtd = build({
      deals: [
        deal({ value: 5997 }),
        deal({ value: null, funnel: "linkedin" }),
        deal({ closerId: "user_1BdSGJ3dJ8llCciTSwvV9X8vHpBq2rHp4meX7Wlzsh0" }),
        deal({ funnel: "Reactivation Scrapers" }),
        deal({ funnel: null }),
        deal({ dateWon: "2026-09-10", leadCreatedAt: "2026-09-01T12:00:00Z" }),
      ],
    });
    expect(mtd.total.current).toMatchObject({
      won: 3,
      revenue: 6997,
      unvalued: 1,
    });
    expect(mtd.rows.map((row) => row.label)).toEqual([
      "Linkedin",
      "YouTube",
      UNKNOWN_CHANNEL,
    ]);
    expect(mtd.total.prior).toMatchObject({ won: 1, cycleDays: [9] });
  });

  it("dates lead-to-win in Pacific and drops negative durations", () => {
    const mtd = build({
      deals: [
        // 2026-10-02 03:00 UTC is still Oct 1 in Pacific.
        deal({ dateWon: "2026-10-03", leadCreatedAt: "2026-10-02T03:00:00Z" }),
        deal({ dateWon: "2026-10-03", leadCreatedAt: "2026-10-09T12:00:00Z" }),
        deal({ dateWon: "2026-10-03", leadCreatedAt: null }),
      ],
    });
    expect(mtd.total.current.cycleDays).toEqual([2]);
    expect(mtd.total.current.won).toBe(3);
  });

  it("puts spend on the one source its band maps to, the rest in the total only", () => {
    expect(spendChannel("Webinar")).toBe("Internal Webinar");
    expect(spendChannel("Google Ads")).toBe("Google Ads");
    expect(spendChannel("Instagram")).toBeNull();
    const mtd = build({
      spend: [
        { day: "2026-10-02", channel: "Webinar", spend: 100 },
        { day: "2026-10-02", channel: "Instagram", spend: 7 },
        { day: "2026-09-02", channel: "Meta Ads", spend: 50 },
      ],
    });
    expect(
      mtd.rows.find((r) => r.label === "Internal Webinar")!.current.spend,
    ).toBe(100);
    expect(mtd.total.current.spend).toBe(107);
    expect(mtd.total.prior.spend).toBe(50);
  });

  it("keeps a channel that only booked last month", () => {
    const mtd = build({
      calls: [call({ funnel: "Meta Ads", bookedDate: "2026-09-03" })],
    });
    expect(mtd.rows).toHaveLength(1);
    expect(mtd.rows[0]).toMatchObject({
      label: "Meta Ads",
      current: { booked: 0 },
      prior: { booked: 1 },
    });
  });
});

describe("buildScorecard", () => {
  it("cuts Monday-Friday weeks and clamps the current one to today", () => {
    expect(scorecardWeeks("2026-09-28", "2026-10-14")).toEqual([
      { from: "2026-09-28", to: "2026-10-02" },
      { from: "2026-10-05", to: "2026-10-09" },
      { from: "2026-10-12", to: "2026-10-14" },
    ]);
  });

  it("counts weekday bookings by who booked, weekends on their own row", () => {
    const card = buildScorecard({
      today: "2026-10-14",
      calls: [
        call({ bookedDate: "2026-09-28" }),
        call({
          bookedDate: "2026-09-29",
          bookedBy: "Lane 2",
          funnel: "Internal Webinar",
        }),
        call({ bookedDate: "2026-09-30", bookedBy: "Social DMs" }),
        call({ bookedDate: "2026-10-03" }),
        call({ bookedDate: "2026-10-04" }),
        call({ bookedDate: "2026-10-13", funnel: "Internal Webinar" }),
      ],
      spend: [
        { day: "2026-09-28", channel: "Webinar", spend: 300 },
        { day: "2026-10-03", channel: "Webinar", spend: 999 },
      ],
    });
    const row = (label: string) =>
      card.rows.find((r) => r.label === label)!.values;
    expect(row("Booked calls (Dom's rule)")).toEqual([3, 0, 1]);
    expect(row("Marketing booked")).toEqual([1, 0, 1]);
    expect(row("Lane 2 booked")).toEqual([1, 0, 0]);
    expect(row("Webinar leads booked by Lane 2")).toEqual([1, 0, 0]);
    expect(row("Social DMs booked")).toEqual([1, 0, 0]);
    expect(row("Booked Sat-Sun (in no week)")).toEqual([2, 0, 0]);
    expect(row("Internal Webinar")).toEqual([0, 0, 1]);
    expect(row("Ad spend")).toEqual([300, 0, 0]);
    expect(row("Cost per marketing booked")).toEqual([300, null, 0]);
    expect(scorecardCsv(card).split("\n")[0]).toBe(
      "Row,2026-09-28 to 2026-10-02,2026-10-05 to 2026-10-09,2026-10-12 to 2026-10-14",
    );
  });

  it("totals webinar rooms in range", () => {
    const event = (date: string) => ({
      date,
      label: "x",
      registrations: 10,
      attendees: 4,
      booked_calls: 2,
      won: null,
      revenue: null,
      spend: 50,
    });
    expect(
      webinarTotals([event("2026-10-02"), event("2026-09-30")], OCT),
    ).toMatchObject({ events: 1, registrations: 10, roomBooked: 2, spend: 50 });
  });
});

describe("comparison math", () => {
  it("clamps the prior day to the prior month's length", () => {
    expect(priorRange({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(priorRange({ from: "2026-01-01", to: "2026-01-14" })).toEqual({
      from: "2025-12-01",
      to: "2025-12-14",
    });
  });

  it("reads New, no change and n/a instead of infinity or 0%", () => {
    expect(countChange(122, 154)).toEqual({
      kind: "pct",
      value: ((122 - 154) / 154) * 100,
    });
    expect(countChange(3, 0)).toEqual({ kind: "new" });
    expect(countChange(0, 0)).toEqual({ kind: "none" });
    expect(countChange(null, 10)).toEqual({ kind: "na" });
    expect(rateChange(74 / 122, 95 / 154)).toEqual({
      kind: "pp",
      value: (74 / 122 - 95 / 154) * 100,
    });
    expect(rateChange(null, 0.5)).toEqual({ kind: "na" });
  });

  it("takes a true median", () => {
    expect(median([])).toBeNull();
    expect(median([10, 2, 8])).toBe(8);
    expect(median([1, 8, 8, 30])).toBe(8);
  });
});

describe("buildGoalPlan", () => {
  it("reproduces Jess's October 14 plan", () => {
    const plan = buildGoalPlan({ booked: 122, today: "2026-10-14" });
    expect(plan).toMatchObject({
      workdaysElapsed: 10,
      workdaysLeft: 12,
      mtdTarget: 250,
      mtdGap: -128,
      monthGoal: 550,
      needed: 428,
      weeklyAverage: 61,
      requiredWeek: 179,
    });
    expect(plan.attainment).toBeCloseTo(0.488, 3);
    expect(plan.requiredDaily).toBeCloseTo(35.67, 2);
    expect(
      plan.segments.map((s) => [
        s.from,
        s.to,
        s.workdays,
        s.calls,
        s.milestone,
      ]),
    ).toEqual([
      ["2026-10-15", "2026-10-16", 2, 72, 194],
      ["2026-10-19", "2026-10-23", 5, 179, 373],
      ["2026-10-26", "2026-10-30", 5, 179, 552],
    ]);
  });

  it("shows the final shortfall with no workdays left", () => {
    const plan = buildGoalPlan({ booked: 500, today: "2026-10-31" });
    expect(plan).toMatchObject({
      workdaysLeft: 0,
      requiredDaily: null,
      needed: 50,
    });
    expect(plan.segments).toEqual([]);
  });
});
