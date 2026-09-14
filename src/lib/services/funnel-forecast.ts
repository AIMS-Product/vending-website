/**
 * The forecast layer: change a rate, see what it does to wins and revenue.
 *
 * Pure, deterministic, no I/O, no rounding until render. The whole engine is
 * one multiplication chain -- it is small on purpose, because the value is in
 * being able to trust it, not in modelling anything clever. A scenario is a
 * proposal, never an observation, so the two are separate types and the page
 * is required to label which one it is printing.
 *
 * Jess's spec models booked -> held -> won -> revenue. This models the two
 * stages above that as well, because unlike SteelTrap we already observe them:
 * `channel_daily` carries visits and leads per channel per day.
 */

export const STAGE_KEYS = [
  "visits",
  "leads",
  "booked",
  "showed",
  "won",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const RATE_KEYS = ["leadPct", "bookPct", "showPct", "winPct"] as const;
export type RateKey = (typeof RATE_KEYS)[number];

/** Which rate carries each stage into the next, and what to call the step. */
export const STEPS: ReadonlyArray<{
  rate: RateKey;
  from: StageKey;
  to: StageKey;
  label: string;
}> = [
  { rate: "leadPct", from: "visits", to: "leads", label: "Visit to lead" },
  { rate: "bookPct", from: "leads", to: "booked", label: "Lead to booked" },
  { rate: "showPct", from: "booked", to: "showed", label: "Booked to showed" },
  { rate: "winPct", from: "showed", to: "won", label: "Showed to won" },
];

/** Observed. Null where no connector reported the stage -- never zero. */
export type FunnelActuals = Record<StageKey, number | null> & {
  revenuePerWin: number | null;
};

/** Proposed. Every field is a number: a scenario has no unknowns by definition. */
export type Scenario = Record<RateKey, number> & {
  visits: number;
  revenuePerWin: number;
};

export type Projection = Record<StageKey, number> & { revenue: number };

export type Delta = Record<StageKey, number | null> & {
  revenue: number | null;
};

/**
 * Seeds the scenario from what was actually observed, so the first thing a
 * user sees is their own funnel and the first delta is zero. A rate we cannot
 * derive falls back to 0 rather than a flattering guess; the page marks the
 * stage unavailable so nobody reads the 0 as a measurement.
 */
export function seedScenario(actuals: FunnelActuals): Scenario {
  return {
    visits: actuals.visits ?? 0,
    leadPct: rate(actuals.leads, actuals.visits),
    bookPct: rate(actuals.booked, actuals.leads),
    showPct: rate(actuals.showed, actuals.booked),
    winPct: rate(actuals.won, actuals.showed),
    revenuePerWin: actuals.revenuePerWin ?? 0,
  };
}

/** The chain. No intermediate rounding: the page formats, the engine does not. */
export function project(scenario: Scenario): Projection {
  const visits = scenario.visits;
  const leads = visits * (scenario.leadPct / 100);
  const booked = leads * (scenario.bookPct / 100);
  const showed = booked * (scenario.showPct / 100);
  const won = showed * (scenario.winPct / 100);
  return {
    visits,
    leads,
    booked,
    showed,
    won,
    revenue: won * scenario.revenuePerWin,
  };
}

/** Scenario minus actual. Null wherever the actual was never observed. */
export function delta(actuals: FunnelActuals, projection: Projection): Delta {
  const out = {} as Delta;
  for (const key of STAGE_KEYS) {
    const actual = actuals[key];
    out[key] = actual == null ? null : projection[key] - actual;
  }
  const revenue =
    actuals.won != null && actuals.revenuePerWin != null
      ? projection.revenue - actuals.won * actuals.revenuePerWin
      : null;
  out.revenue = revenue;
  return out;
}

export type Sensitivity = {
  rate: RateKey;
  label: string;
  /** Extra wins from adding one percentage point to this rate alone. */
  wins: number;
  /** Extra revenue from the same one point. */
  revenue: number;
};

/**
 * What one percentage point is worth at each step, holding everything else
 * still. Deterministic arithmetic, not a recommendation: it says where a point
 * buys the most, not that the point is available.
 */
export function sensitivity(scenario: Scenario): Sensitivity[] {
  const base = project(scenario);
  return STEPS.map(({ rate, label }) => {
    const bumped = project({ ...scenario, [rate]: scenario[rate] + 1 });
    return {
      rate,
      label,
      wins: bumped.won - base.won,
      revenue: bumped.revenue - base.revenue,
    };
  });
}

export type Leak = {
  rate: RateKey;
  label: string;
  from: StageKey;
  to: StageKey;
  /** People who reached `from` and never reached `to`. */
  lost: number;
  /** The rate that let them through, as a percentage. */
  pct: number;
};

/**
 * The step that loses the most people in absolute terms.
 *
 * Absolute, not proportional, on purpose: a 20% step at the top of a big
 * funnel wastes more people than a 60% step at the bottom of a small one, and
 * the point of the callout is where the bodies are. Null when a stage on
 * either side was never observed -- an unmeasured step is not a leak, it is a
 * blind spot, and calling it the worst one would be the map lying about what
 * it knows.
 */
export function biggestLeak(actuals: FunnelActuals): Leak | null {
  let worst: Leak | null = null;
  for (const { rate, from, to, label } of STEPS) {
    const above = actuals[from];
    const below = actuals[to];
    if (above == null || below == null || above <= 0) continue;
    const lost = above - below;
    if (lost <= 0) continue;
    if (!worst || lost > worst.lost) {
      worst = { rate, label, from, to, lost, pct: (below / above) * 100 };
    }
  }
  return worst;
}

/** Percentage, or 0 when the denominator is missing or empty. */
function rate(numerator: number | null, denominator: number | null): number {
  if (numerator == null || denominator == null || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}
