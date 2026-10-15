/**
 * Prove the Marketing MTD page counts what the Months V2 panel counts:
 * Dom's booked_calls.v2.2, month to date, per bucket and per lead source.
 * Read-only; runs the page's and the panel's own loaders.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/marketing-mtd-validate.ts
 *
 * Exit 0 = every figure equal, 2 = differences (printed), 1 = error. Also
 * prints Sep 1-14 on Dom's rule beside Jess's field-based reference, the gap
 * the rule change makes.
 */
import { AsyncLocalStorage } from "node:async_hooks";

// Next's server modules expect its runtime: async storage at import time and a
// request cache for `unstable_cache`, which here misses every time.
Object.assign(globalThis, {
  AsyncLocalStorage,
  __incrementalCache: {
    generateSimpleCacheKey: (parts: unknown) => JSON.stringify(parts),
    get: async () => null,
    set: async () => undefined,
    isOnDemandRevalidate: false,
  },
});

/** Jess's handoff (2026-10-14), field-based: first call per lead, Lane 1 roster. */
const JESS_SEP_1_14 = {
  booked: 154,
  shown: 95,
  qualified: 66,
  won: 15,
  revenue: 103_290,
  cycle: 10,
};

async function main() {
  const { getBookedCallsV2, monthToDateWindow } =
    await import("../src/lib/services/booked-calls-v2-data");
  const { UNKNOWN_CHANNEL, median } =
    await import("../src/lib/services/marketing-mtd");
  const { getMarketingMtd } =
    await import("../src/lib/services/marketing-mtd-data");
  const [panel, page] = await Promise.all([
    getBookedCallsV2(monthToDateWindow()),
    getMarketingMtd(),
  ]);
  if (!panel.ok) throw new Error(`Months V2 panel read failed: ${panel.error}`);
  if (!page.ok) throw new Error(`Marketing MTD read failed: ${page.error}`);
  const { mtd } = page;
  const s = panel.summary;

  const checks: Array<[string, number, number]> = [
    ["Marketing booked", mtd.total.current.booked, s.byBookedBy.Marketing],
    ["Lane 2 booked", mtd.total.current.lane2, s.byBookedBy["Lane 2"]],
    ["Social DMs booked", mtd.socialDms.current, s.byBookedBy["Social DMs"]],
  ];
  const labels = new Set([
    ...Object.keys(s.byOrigin).map((o) =>
      o === "Unknown" ? UNKNOWN_CHANNEL : o,
    ),
    ...mtd.rows.map((r) => r.label),
  ]);
  for (const label of [...labels].sort()) {
    const origin =
      s.byOrigin[label === UNKNOWN_CHANNEL ? "Unknown" : label] ?? {};
    const row = mtd.rows.find((r) => r.label === label)?.current;
    checks.push([
      `${label} · Marketing`,
      row?.booked ?? 0,
      origin.Marketing ?? 0,
    ]);
    checks.push([`${label} · Lane 2`, row?.lane2 ?? 0, origin["Lane 2"] ?? 0]);
  }

  console.log(
    `Month to date ${mtd.current.from}..${mtd.current.to}, page vs Months V2 panel`,
  );
  const diffs = checks.filter(([, a, b]) => a !== b);
  for (const [label, a, b] of checks) {
    if (a || b)
      console.log(
        `${a === b ? "  ok  " : "  DIFF"} ${label}: page ${a}, panel ${b}`,
      );
  }

  const sep = mtd.total.prior;
  console.log(
    `\n${mtd.prior.from}..${mtd.prior.to} on Dom's rule vs Jess's field-based reference (Sep 1-14):`,
  );
  console.log(
    `  booked ${sep.booked} vs ${JESS_SEP_1_14.booked}, shown ${sep.shown} vs ${JESS_SEP_1_14.shown}, qualified ${sep.qualified} vs ${JESS_SEP_1_14.qualified}`,
  );
  console.log(
    `  won ${sep.won} vs ${JESS_SEP_1_14.won}, revenue ${sep.revenue} vs ${JESS_SEP_1_14.revenue}, cycle ${median(sep.cycleDays)} vs ${JESS_SEP_1_14.cycle}`,
  );

  console.log(
    diffs.length === 0
      ? "\nPARITY: every figure equal."
      : `\n${diffs.length} differences.`,
  );
  process.exit(diffs.length === 0 ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
