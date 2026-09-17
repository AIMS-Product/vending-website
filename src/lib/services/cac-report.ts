import "server-only";

/**
 * The MTD CAC model, as the workbook computes it, with the three things that made
 * the workbook drift removed.
 *
 * 1. Proration came from a hand-typed "Days Elapsed". Here a null means derive it
 *    from today, so a live month prorates itself and a closed month can still pin
 *    the number it reported.
 * 2. Variable spend was pasted from elsewhere. A route that names a channel can
 *    read its own spend; the typed number stays alongside so the two are always
 *    comparable, and switching between them is a human decision, never automatic.
 * 3. On four September rows the Total MTD Cost formula had been typed over, so the
 *    total no longer equalled prorated fixed + variable and nothing said so. Here
 *    the total is always derived, and `spendDisagreement` reports the gap between
 *    what a human typed and what the channel spine observed rather than picking one.
 *
 * Null is never zero. A route with no cost model, no recorded closes or no
 * benchmark returns null for the figures that depend on it and the UI prints the
 * workbook's own words ("No Model", "No Closes") instead of a confident number.
 */

export type CacRouteInput = {
  readonly id: string;
  readonly groupLabel: string;
  readonly route: string;
  readonly owner: string | null;
  readonly sortOrder: number;
  readonly fixedMonthlyCost: number | null;
  readonly variableSpend: number | null;
  readonly spendChannel: string | null;
  readonly spendSource: "manual" | "auto";
  readonly closedWon: number | null;
  readonly marchCac: number | null;
  readonly notes: string | null;
};

export type CacMonthInput = {
  readonly month: string;
  readonly daysInMonth: number;
  readonly daysElapsed: number | null;
  readonly note: string | null;
};

/** Observed ad spend for the month, keyed 'channel|source'. Absent means no feed. */
export type ObservedSpend = ReadonlyMap<string, number>;

export type CacStatus =
  | "beating"
  | "moderate"
  | "critical"
  | "no-closes"
  | "no-benchmark"
  | "no-model";

export type CacRouteRow = CacRouteInput & {
  readonly proratedFixedCost: number | null;
  /** The spend the total actually used, after spendSource. */
  readonly spendUsed: number | null;
  /** What channel_daily reports for spendChannel, or null when there is no feed. */
  readonly observedSpend: number | null;
  /**
   * Typed minus observed, when both exist and differ by more than a dollar. The
   * workbook hid this by overwriting the total; here it is its own number so a
   * $20,000 entry against $6,334 of observed spend is visible rather than averaged.
   */
  readonly spendDisagreement: number | null;
  readonly totalCost: number | null;
  readonly cac: number | null;
  readonly deltaAbsolute: number | null;
  readonly deltaPercent: number | null;
  readonly status: CacStatus;
};

export type CacReport = {
  readonly month: string;
  readonly daysInMonth: number;
  readonly daysElapsed: number;
  readonly daysElapsedIsDerived: boolean;
  readonly prorationFactor: number;
  readonly rows: readonly CacRouteRow[];
  readonly total: {
    readonly totalCost: number | null;
    readonly closedWon: number | null;
    readonly cac: number | null;
    /** Routes whose typed spend and observed spend disagree by more than a dollar. */
    readonly routesWithSpendDisagreement: number;
    /** Routes carrying closes but no cost model: their closes land in the blended CAC with no cost. */
    readonly routesWithoutCostModel: number;
  };
};

/** Percent of the month elapsed. A month is never zero days, so this cannot divide by zero. */
export function prorationFactor(
  daysElapsed: number,
  daysInMonth: number,
): number {
  return Math.min(1, Math.max(0, daysElapsed / daysInMonth));
}

/**
 * Days elapsed for a month, derived from `today` when nobody pinned it. A month in
 * the past counts all of its days; a month in the future counts none. This is the
 * hand-typed cell that silently froze the workbook's proration between updates.
 */
export function daysElapsedFor(
  month: string,
  daysInMonth: number,
  pinned: number | null,
  today: Date,
): { days: number; derived: boolean } {
  if (pinned != null) return { days: pinned, derived: false };
  const start = Date.parse(`${month.slice(0, 7)}-01T00:00:00Z`);
  const now = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  if (Number.isNaN(start)) return { days: daysInMonth, derived: true };
  const elapsed = Math.floor((now - start) / 86_400_000) + 1;
  return { days: Math.min(daysInMonth, Math.max(0, elapsed)), derived: true };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function statusFor(
  cac: number | null,
  marchCac: number | null,
  closedWon: number | null,
  hasCostModel: boolean,
): CacStatus {
  if (!hasCostModel) return "no-model";
  if (closedWon == null || closedWon === 0) return "no-closes";
  if (cac == null) return "no-closes";
  if (marchCac == null) return "no-benchmark";
  if (cac <= marchCac) return "beating";
  // The workbook's own cut: a fifth over the benchmark stops being noise.
  return (cac - marchCac) / marchCac > 0.2 ? "critical" : "moderate";
}

export function buildCacReport(
  month: CacMonthInput,
  routes: readonly CacRouteInput[],
  observed: ObservedSpend,
  today = new Date(),
): CacReport {
  const { days, derived } = daysElapsedFor(
    month.month,
    month.daysInMonth,
    month.daysElapsed,
    today,
  );
  const factor = prorationFactor(days, month.daysInMonth);

  const rows = [...routes]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.route.localeCompare(b.route))
    .map((route): CacRouteRow => {
      const observedSpend =
        route.spendChannel != null && observed.has(route.spendChannel)
          ? round2(observed.get(route.spendChannel)!)
          : null;
      const spendUsed =
        route.spendSource === "auto" ? observedSpend : route.variableSpend;
      const proratedFixedCost =
        route.fixedMonthlyCost == null
          ? null
          : round2(route.fixedMonthlyCost * factor);
      // A route with no cost model still has spend, so the total is whichever
      // parts exist. Null only when neither does: nothing observed is not $0 spent.
      const parts = [proratedFixedCost, spendUsed].filter(
        (part): part is number => part != null,
      );
      const totalCost = parts.length
        ? round2(parts.reduce((a, b) => a + b, 0))
        : null;
      const cac =
        totalCost != null && route.closedWon != null && route.closedWon > 0
          ? round2(totalCost / route.closedWon)
          : null;
      const spendDisagreement =
        route.variableSpend != null &&
        observedSpend != null &&
        Math.abs(route.variableSpend - observedSpend) > 1
          ? round2(route.variableSpend - observedSpend)
          : null;
      const deltaAbsolute =
        cac != null && route.marchCac != null
          ? round2(cac - route.marchCac)
          : null;
      const deltaPercent =
        cac != null && route.marchCac != null && route.marchCac > 0
          ? round2(((cac - route.marchCac) / route.marchCac) * 100)
          : null;
      return {
        ...route,
        proratedFixedCost,
        spendUsed,
        observedSpend,
        spendDisagreement,
        totalCost,
        cac,
        deltaAbsolute,
        deltaPercent,
        status: statusFor(
          cac,
          route.marchCac,
          route.closedWon,
          route.fixedMonthlyCost != null || spendUsed != null,
        ),
      };
    });

  const sum = (pick: (row: CacRouteRow) => number | null) => {
    const seen = rows.map(pick).filter((v): v is number => v != null);
    return seen.length ? round2(seen.reduce((a, b) => a + b, 0)) : null;
  };
  const totalCost = sum((row) => row.totalCost);
  const closedWon = sum((row) => row.closedWon);
  return {
    month: month.month,
    daysInMonth: month.daysInMonth,
    daysElapsed: days,
    daysElapsedIsDerived: derived,
    prorationFactor: Math.round(factor * 10_000) / 10_000,
    rows,
    total: {
      totalCost,
      closedWon,
      cac:
        totalCost != null && closedWon != null && closedWon > 0
          ? round2(totalCost / closedWon)
          : null,
      routesWithSpendDisagreement: rows.filter(
        (r) => r.spendDisagreement != null,
      ).length,
      // These routes contribute closes to the blended CAC while contributing no
      // cost, which pulls the blended number down. The workbook did this silently.
      routesWithoutCostModel: rows.filter(
        (r) => r.fixedMonthlyCost == null && (r.closedWon ?? 0) > 0,
      ).length,
    },
  };
}
