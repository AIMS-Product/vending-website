import { describe, expect, it } from "vitest";
import {
  buildCacReport,
  daysElapsedFor,
  prorationFactor,
  type CacMonthInput,
  type CacRouteInput,
} from "./cac-report";

const september: CacMonthInput = {
  month: "2026-09-01",
  daysInMonth: 30,
  daysElapsed: 13,
  note: null,
};

const route = (over: Partial<CacRouteInput> = {}): CacRouteInput => ({
  id: "r1",
  groupLabel: "IN-HOUSE ROUTES",
  route: "Internal Webinar",
  owner: "Alysia Boyer",
  sortOrder: 1,
  fixedMonthlyCost: 2491,
  variableSpend: 20000,
  spendChannel: "Webinar|meta_ads",
  spendSource: "manual",
  closedWon: 3,
  marchCac: 3953,
  notes: null,
  updatedAt: "2026-09-17T00:00:00Z",
  ...over,
});

describe("buildCacReport", () => {
  it("reproduces the workbook's September numbers", () => {
    const report = buildCacReport(september, [route()], new Map());
    expect(report.prorationFactor).toBe(0.4333);
    const row = report.rows[0]!;
    // 2491 * 13/30, the workbook's $1,079.43.
    expect(row.proratedFixedCost).toBe(1079.43);
    expect(row.totalCost).toBe(21079.43);
    expect(row.cac).toBe(7026.48);
    expect(row.status).toBe("critical");
  });

  it("reports typed spend against observed spend instead of choosing one", () => {
    const observed = new Map([["Webinar|meta_ads", 6334.35]]);
    const manual = buildCacReport(september, [route()], observed).rows[0]!;
    // The workbook hid this by typing over the total. $20,000 entered, $6,334.35 seen.
    expect(manual.spendUsed).toBe(20000);
    expect(manual.observedSpend).toBe(6334.35);
    expect(manual.spendDisagreement).toBe(13665.65);

    // Switching the source is a human decision, and it changes the total, not the record.
    const auto = buildCacReport(
      september,
      [route({ spendSource: "auto" })],
      observed,
    ).rows[0]!;
    expect(auto.spendUsed).toBe(6334.35);
    expect(auto.variableSpend).toBe(20000);
    expect(auto.totalCost).toBe(7413.78);
    expect(auto.cac).toBe(2471.26);
  });

  it("never prints a number for a route with no closes, no model, or no benchmark", () => {
    const rows = buildCacReport(
      september,
      [
        route({ id: "a", route: "VSL", closedWon: 0, sortOrder: 1 }),
        route({
          id: "b",
          route: "Website / SEO / PPC",
          fixedMonthlyCost: null,
          variableSpend: 3400,
          spendChannel: null,
          closedWon: 2,
          marchCac: null,
          sortOrder: 2,
        }),
        route({
          id: "c",
          route: "Mike Newsletter",
          closedWon: 4,
          marchCac: null,
          sortOrder: 3,
        }),
      ],
      new Map(),
    ).rows;
    expect(rows[0]!.cac).toBeNull();
    expect(rows[0]!.status).toBe("no-closes");
    // Spend without a salary model still totals: nothing observed is not nothing spent.
    expect(rows[1]!.proratedFixedCost).toBeNull();
    expect(rows[1]!.totalCost).toBe(3400);
    expect(rows[1]!.cac).toBe(1700);
    expect(rows[1]!.status).toBe("no-benchmark");
    expect(rows[2]!.status).toBe("no-benchmark");
  });

  it("counts the routes that quietly pull the blended CAC down", () => {
    const report = buildCacReport(
      september,
      [
        route({ id: "a", sortOrder: 1 }),
        route({
          id: "b",
          route: "Referred",
          fixedMonthlyCost: null,
          variableSpend: null,
          spendChannel: null,
          closedWon: 6,
          sortOrder: 2,
        }),
      ],
      new Map(),
    );
    // Six closes carrying no cost sit in the denominator of the blended CAC.
    expect(report.total.routesWithoutCostModel).toBe(1);
    expect(report.total.closedWon).toBe(9);
    expect(report.total.totalCost).toBe(21079.43);
    expect(report.total.cac).toBe(2342.16);
  });

  it("derives days elapsed when nobody pinned it, and pins it when they did", () => {
    expect(
      daysElapsedFor("2026-09-01", 30, 13, new Date("2026-09-17T12:00:00Z")),
    ).toEqual({
      days: 13,
      derived: false,
    });
    // The hand-typed cell is what froze the workbook between weekly updates.
    expect(
      daysElapsedFor("2026-09-01", 30, null, new Date("2026-09-17T12:00:00Z")),
    ).toEqual({
      days: 17,
      derived: true,
    });
    // A closed month counts all of its days; a future month counts none.
    expect(
      daysElapsedFor("2026-05-01", 31, null, new Date("2026-09-17T12:00:00Z"))
        .days,
    ).toBe(31);
    expect(
      daysElapsedFor("2026-12-01", 31, null, new Date("2026-09-17T12:00:00Z"))
        .days,
    ).toBe(0);
  });

  it("clamps the proration factor to the month", () => {
    expect(prorationFactor(13, 30)).toBeCloseTo(0.4333, 4);
    expect(prorationFactor(45, 30)).toBe(1);
    expect(prorationFactor(-3, 30)).toBe(0);
  });
});
