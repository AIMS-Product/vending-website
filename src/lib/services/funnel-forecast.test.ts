import { describe, expect, it } from "vitest";
import {
  biggestLeak,
  delta,
  project,
  seedScenario,
  sensitivity,
  type FunnelActuals,
} from "./funnel-forecast";

const ACTUALS: FunnelActuals = {
  visits: 10_000,
  leads: 1_000,
  booked: 100,
  showed: 60,
  won: 12,
  revenuePerWin: 7_000,
};

describe("seedScenario", () => {
  it("starts on the observed funnel, so the first delta is zero", () => {
    const scenario = seedScenario(ACTUALS);
    expect(scenario).toEqual({
      visits: 10_000,
      leadPct: 10,
      bookPct: 10,
      showPct: 60,
      winPct: 20,
      revenuePerWin: 7_000,
    });
    expect(delta(ACTUALS, project(scenario))).toMatchObject({
      won: 0,
      revenue: 0,
    });
  });

  it("does not invent a rate from a stage nobody observed", () => {
    const scenario = seedScenario({ ...ACTUALS, leads: null });
    expect(scenario.leadPct).toBe(0);
    expect(scenario.bookPct).toBe(0);
  });
});

describe("project", () => {
  it("runs the chain without rounding on the way down", () => {
    const projection = project({
      visits: 10_000,
      leadPct: 10,
      bookPct: 10,
      showPct: 70,
      winPct: 20,
      revenuePerWin: 7_000,
    });
    expect(projection.booked).toBe(100);
    expect(projection.showed).toBeCloseTo(70, 10);
    expect(projection.won).toBeCloseTo(14, 10);
    expect(projection.revenue).toBeCloseTo(98_000, 10);
  });

  it("keeps a fractional person fractional rather than rounding it away", () => {
    const projection = project({
      visits: 1_000,
      leadPct: 33.3,
      bookPct: 10,
      showPct: 50,
      winPct: 50,
      revenuePerWin: 100,
    });
    expect(projection.leads).toBeCloseTo(333, 10);
    expect(projection.won).toBeCloseTo(8.325, 10);
  });
});

describe("delta", () => {
  it("moving show rate to 70% lifts wins and revenue, actuals untouched", () => {
    const scenario = { ...seedScenario(ACTUALS), showPct: 70 };
    const change = delta(ACTUALS, project(scenario));
    expect(change.showed).toBeCloseTo(10, 10);
    expect(change.won).toBeCloseTo(2, 10);
    expect(change.revenue).toBeCloseTo(14_000, 10);
    expect(ACTUALS.showed).toBe(60);
  });

  it("stays null where the actual was never observed", () => {
    const change = delta(
      { ...ACTUALS, leads: null },
      project(seedScenario(ACTUALS)),
    );
    expect(change.leads).toBeNull();
    expect(change.won).toBeCloseTo(0, 10);
  });

  it("withholds a revenue delta when revenue per win is unknown", () => {
    const change = delta(
      { ...ACTUALS, revenuePerWin: null },
      project(seedScenario(ACTUALS)),
    );
    expect(change.revenue).toBeNull();
  });
});

describe("sensitivity", () => {
  it("prices one percentage point at every step", () => {
    const points = sensitivity(seedScenario(ACTUALS));
    const show = points.find((p) => p.rate === "showPct")!;
    // 100 booked * 1pp * 20% win * $7,000
    expect(show.revenue).toBeCloseTo(1_400, 6);
    const win = points.find((p) => p.rate === "winPct")!;
    // 60 held * 1pp * $7,000
    expect(win.revenue).toBeCloseTo(4_200, 6);
  });

  it("is worth nothing downstream of a stage that converts nobody", () => {
    const points = sensitivity({ ...seedScenario(ACTUALS), bookPct: 0 });
    expect(points.find((p) => p.rate === "winPct")!.revenue).toBe(0);
  });
});

describe("biggestLeak", () => {
  it("names the step that loses the most people, not the worst rate", () => {
    const leak = biggestLeak(ACTUALS)!;
    // Visit-to-lead drops 9,000; showed-to-won drops 48 at a far worse rate.
    expect(leak.rate).toBe("leadPct");
    expect(leak.lost).toBe(9_000);
    expect(leak.pct).toBeCloseTo(10, 10);
  });

  it("will not call an unmeasured step the worst one", () => {
    // With visits and leads unobserved the biggest measured loss is the 48
    // held calls that never won -- not the 9,000 visits, which are now a blind
    // spot rather than a leak.
    const leak = biggestLeak({ ...ACTUALS, visits: null, leads: null })!;
    expect(leak.rate).toBe("winPct");
    expect(leak.lost).toBe(48);
  });

  it("returns nothing when no step is fully observed", () => {
    expect(
      biggestLeak({
        visits: null,
        leads: null,
        booked: null,
        showed: null,
        won: null,
        revenuePerWin: null,
      }),
    ).toBeNull();
  });
});
