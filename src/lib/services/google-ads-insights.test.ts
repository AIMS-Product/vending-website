import { describe, expect, it } from "vitest";
import {
  BASELINE,
  keywordNote,
  PRE_TRACKING,
  beforeAfter,
  campaignHealth,
  leadKeyword,
  wastedSearchTerms,
  weeklyTrend,
} from "./google-ads-insights";

const lead = (day: string, booked = false, wonValue = 0) => ({
  day,
  booked,
  won: wonValue > 0,
  wonValue,
});

describe("weeklyTrend", () => {
  it("buckets spend and leads into Monday weeks with cost per booked call", () => {
    const weeks = weeklyTrend(
      [
        { day: "2026-10-05", cost: 100 },
        { day: "2026-10-11", cost: 50 }, // Sunday, same week
        { day: "2026-10-12", cost: 80 },
      ],
      [
        lead("2026-10-06", true),
        lead("2026-10-07", true, 5997),
        lead("2026-10-12"),
      ],
    );
    expect(weeks).toEqual([
      {
        weekStart: "2026-10-05",
        spend: 150,
        leads: 2,
        booked: 2,
        wonValue: 5997,
        costPerBooked: 75,
      },
      {
        weekStart: "2026-10-12",
        spend: 80,
        leads: 1,
        booked: 0,
        wonValue: 0,
        costPerBooked: null,
      },
    ]);
  });
});

describe("beforeAfter", () => {
  it("compares the frozen baseline with everything since the change date", () => {
    const result = beforeAfter(
      [
        { day: "2026-10-09", cost: 999 }, // before the change: ignored
        { day: "2026-10-10", cost: 100 },
        { day: "2026-10-11", cost: 110 },
      ],
      [lead("2026-10-09", true), lead("2026-10-10", true), lead("2026-10-11")],
      "2026-10-11",
    );
    expect(result.before.costPerBooked).toBe(149.25);
    expect(result.before.booked).toBe(BASELINE.booked);
    expect(result.after).toMatchObject({
      from: "2026-10-10",
      to: "2026-10-11",
      days: 2,
      spend: 210,
      booked: 1,
      costPerBooked: 210,
      spendPerWeek: 735,
      bookedPerWeek: 3.5,
    });
    expect(result.settled).toBe(false);
  });

  it("has no after window before the change and settles after the readout day", () => {
    expect(beforeAfter([], [], "2026-10-09").after).toBeNull();
    expect(beforeAfter([], [], "2026-10-25").settled).toBe(true);
  });
});

describe("wastedSearchTerms", () => {
  it("lists terms over the spend floor that never converted, merged across campaigns", () => {
    const wasted = wastedSearchTerms(
      [
        { term: "Vending Jobs", campaignId: "1", cost: 20, clicks: 4 },
        { term: "vending jobs", campaignId: "2", cost: 15, clicks: 3 },
        {
          term: "vending machine business",
          campaignId: "1",
          cost: 900,
          clicks: 400,
        },
        { term: "cheap snacks", campaignId: "1", cost: 10, clicks: 2 },
      ],
      new Set(["vending machine business"]),
    );
    expect(wasted).toEqual([{ term: "vending jobs", cost: 35, clicks: 7 }]);
  });
});

describe("campaignHealth", () => {
  const campaign = {
    campaignId: "1",
    name: "VP | W2",
    status: "ENABLED",
    primaryStatus: "LIMITED",
    reasons: ["BUDGET_CONSTRAINED", "HAS_ADS_DISAPPROVED"],
    dailyBudget: 150,
  };
  const ad = (approval: string, review = "REVIEWED", status = "ENABLED") => ({
    campaignId: "1",
    adGroupStatus: "ENABLED",
    status,
    approval,
    review,
  });

  it("flags a campaign whose live ads are all disapproved", () => {
    const [health] = campaignHealth(
      [campaign],
      [ad("DISAPPROVED"), ad("DISAPPROVED")],
    );
    expect(health.flags[0]).toBe("Not serving: no approved ads");
    expect(health.flags).toContain("Limited by budget");
    expect(health.disapproved).toBe(2);
  });

  it("says under review instead of not serving while new ads wait", () => {
    const [health] = campaignHealth(
      [{ ...campaign, reasons: [] }],
      [
        ad("UNKNOWN", "REVIEW_IN_PROGRESS"),
        ad("DISAPPROVED", "REVIEWED", "PAUSED"),
      ],
    );
    expect(health.flags).toEqual(["No approved ads yet: new ads under review"]);
    expect(health.liveAds).toBe(1);
  });

  it("does not flag a paused campaign, and a healthy one has no flags", () => {
    const paused = campaignHealth(
      [{ ...campaign, status: "PAUSED" }],
      [ad("DISAPPROVED")],
    );
    expect(paused[0].flags).toEqual([]);
    const ok = campaignHealth([{ ...campaign, reasons: [] }], [ad("APPROVED")]);
    expect(ok[0].flags).toEqual([]);
  });
});

describe("leadKeyword", () => {
  it("prefers utm_term, then the click's keyword, then pre-tracking", () => {
    expect(leadKeyword(" Vending Machine Cost ", "other")).toBe(
      "vending machine cost",
    );
    expect(leadKeyword(null, "Vending Business")).toBe("vending business");
    expect(leadKeyword("{keyword}", null)).toBe(PRE_TRACKING);
    expect(leadKeyword(null, undefined)).toBe(PRE_TRACKING);
  });
});

describe("keywordNote", () => {
  const totals = { leads: 100, booked: 52 };
  it("warns while leads have no keyword, and says why", () => {
    const rows = [{ key: PRE_TRACKING, leads: 98, booked: 51 }];
    expect(keywordNote(rows, totals, false)).toMatch(
      /^98 of 100 leads \(51 of 52 booked calls\).*pending database update/,
    );
    expect(keywordNote(rows, totals, true)).toMatch(/could not be matched/);
  });
  it("is silent once every lead has a keyword", () => {
    expect(
      keywordNote([{ key: "x", leads: 3, booked: 1 }], totals, false),
    ).toBe(null);
  });
});
