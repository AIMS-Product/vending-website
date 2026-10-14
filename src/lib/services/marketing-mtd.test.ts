import { describe, expect, it } from "vitest";
import type { CloseCall } from "@/lib/services/close-week-view";
import type { CloseDeal } from "@/lib/services/close-wins";
import {
  buildGoalPlan,
  buildMarketingMtd,
  countChange,
  median,
  priorRange,
  rateChange,
  UNKNOWN_CHANNEL,
} from "@/lib/services/marketing-mtd";

const OWNER = "Joe Dysert";
const call = (over: Partial<CloseCall>): CloseCall => ({
  leadId: `lead_${Math.random()}`,
  funnel: "YouTube",
  status: "Booked",
  bookedDate: "2026-10-05",
  showUp: null,
  qualified: null,
  leadOwner: OWNER,
  businessLine: null,
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

describe("buildMarketingMtd", () => {
  it("applies Jess's booked filters and keeps the quiz funnel", () => {
    const mtd = buildMarketingMtd({
      current: OCT,
      calls: [
        call({ funnel: "LTF - Quiz Funnel" }),
        call({ funnel: "Reactivation Scrapers" }),
        call({ leadOwner: "Someone Else" }),
        call({ status: "🔻 Canceled (by Lead)" }),
        call({ businessLine: "The Land Geek (TLG)" }),
        call({ funnel: null }),
        call({ funnel: "Linkedin" }),
      ],
      deals: [],
    });
    expect(mtd.total.current.booked).toBe(3);
    expect(mtd.rows.map((row) => row.label)).toEqual([
      "LinkedIn",
      "LTF - Quiz Funnel",
      UNKNOWN_CHANNEL,
    ]);
    expect(mtd.rows[0]!.current.rawValues).toEqual(["Linkedin"]);
  });

  it("nests qualified inside shown and lists the conflicts", () => {
    const mtd = buildMarketingMtd({
      current: OCT,
      calls: [
        call({ showUp: "Yes", qualified: "Yes" }),
        call({ showUp: "true", qualified: "no" }),
        call({ leadId: "lead_conflict", showUp: null, qualified: "1" }),
      ],
      deals: [],
    });
    expect(mtd.total.current).toMatchObject({
      booked: 3,
      shown: 2,
      qualified: 1,
    });
    expect(mtd.total.current.conflicts).toEqual([
      { leadId: "lead_conflict", name: null },
    ]);
  });

  it("counts wins on their own, without the roster, minus excluded closers", () => {
    const mtd = buildMarketingMtd({
      current: OCT,
      calls: [],
      deals: [
        deal({ value: 5997 }),
        deal({ value: null }),
        deal({ closerId: "user_1BdSGJ3dJ8llCciTSwvV9X8vHpBq2rHp4meX7Wlzsh0" }),
        deal({ funnel: "Reactivation Scrapers" }),
        deal({ dateWon: "2026-09-10", leadCreatedAt: "2026-09-01T12:00:00Z" }),
      ],
    });
    expect(mtd.total.current).toMatchObject({
      won: 2,
      revenue: 5997,
      unvalued: 1,
    });
    expect(mtd.total.prior).toMatchObject({ won: 1, cycleDays: [9] });
  });

  it("dates lead-to-win in Pacific and drops negative durations", () => {
    const mtd = buildMarketingMtd({
      current: OCT,
      calls: [],
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

  it("keeps a channel that only booked last month", () => {
    const mtd = buildMarketingMtd({
      current: OCT,
      calls: [call({ funnel: "Meta Ads", bookedDate: "2026-09-03" })],
      deals: [],
    });
    expect(mtd.rows).toHaveLength(1);
    expect(mtd.rows[0]).toMatchObject({
      label: "Meta Ads",
      current: { booked: 0 },
      prior: { booked: 1 },
    });
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
