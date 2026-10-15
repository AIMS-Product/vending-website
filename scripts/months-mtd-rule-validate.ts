/**
 * Prove Months (grid, Fri-Thu weeks) and the EOD/EOW email count on the rule
 * every booked-call surface uses since #187 (Jess's field rule,
 * `keptByMtdRule`). Read-only; runs the pages' own loaders.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/months-mtd-rule-validate.ts
 *
 * Checks: this month's grid booked, Reactivation Scrapers row aside, equals
 * Marketing MTD's booked; every complete week's booked equals the
 * dashboard's own `keptCalls` over the same days. Exit 0 = equal, 2 = differs.
 */
import { AsyncLocalStorage } from "node:async_hooks";

Object.assign(globalThis, {
  AsyncLocalStorage,
  __incrementalCache: {
    generateSimpleCacheKey: (parts: unknown) => JSON.stringify(parts),
    get: async () => null,
    set: async () => undefined,
    isOnDemandRevalidate: false,
  },
});

async function main() {
  const { getCloseMonthlyFunnel } =
    await import("../src/lib/services/close-monthly-funnel-data");
  const { getCloseWeekView } =
    await import("../src/lib/services/close-week-view-data");
  const { getMarketingMtd } =
    await import("../src/lib/services/marketing-mtd-data");
  const { readCalls } =
    await import("../src/lib/services/analytics-dashboard-data");
  const { keptCalls, inRange } =
    await import("../src/lib/analytics/dashboard-metrics");
  const { pacificToday } = await import("../src/lib/admin/format-time");

  const [monthly, weeks, page] = await Promise.all([
    getCloseMonthlyFunnel(),
    getCloseWeekView(),
    getMarketingMtd(),
  ]);
  if (!monthly.ok) throw new Error(monthly.error);
  if (!weeks.ok) throw new Error(weeks.error);
  if (!page.ok) throw new Error(page.error);

  const checks: Array<[string, number, number]> = [];
  const month = pacificToday().slice(0, 7);
  const scraperRow = monthly.funnel.rows.find(
    (r) => r.label === "Reactivation Scrapers",
  );
  const gridMonth = monthly.funnel.months.find((m) => m.key === month);
  checks.push([
    `${month} grid marketing booked vs Marketing MTD`,
    (gridMonth?.totals.booked ?? 0) - (scraperRow?.byMonth[month]?.booked ?? 0),
    page.mtd.total.current.booked,
  ]);

  const complete = weeks.weeks.filter((w) => w.complete);
  const from = complete.at(-1)?.key;
  const to = complete[0]?.end;
  if (from && to) {
    const calls = await readCalls(from, to);
    if (!calls.ok) throw new Error(calls.error);
    for (const week of complete) {
      const range = { startDay: week.key, endDay: week.end };
      checks.push([
        `week ${week.key} booked vs dashboard keptCalls`,
        week.totals.booked,
        keptCalls(calls.data).filter((c) => inRange(c.bookedDate, range))
          .length,
      ]);
    }
  }

  let diffs = 0;
  for (const [label, ours, theirs] of checks) {
    const ok = ours === theirs;
    if (!ok) diffs += 1;
    console.log(`${ok ? "ok  " : "DIFF"} ${label}: ${ours} / ${theirs}`);
  }
  process.exit(diffs === 0 ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
