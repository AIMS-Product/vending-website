/**
 * Prove Channels' "Booked by channel" table and the KPI export's first
 * section (both `readRuleFlow`) count what the dashboard and Marketing MTD
 * count. Read-only; runs the pages' own loaders. This month to today.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/channels-mtd-rule-validate.ts
 *
 * Exit 0 = the band total equals the dashboard's `keptCalls` and the total
 * minus Reactivation Scrapers leads equals Marketing MTD's booked; 2 = differs.
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
  const { readRuleFlow, readCalls } =
    await import("../src/lib/services/analytics-dashboard-data");
  const { keptCalls, inRange } =
    await import("../src/lib/analytics/dashboard-metrics");
  const { getMarketingMtd } =
    await import("../src/lib/services/marketing-mtd-data");
  const { pacificToday } = await import("../src/lib/admin/format-time");
  const { isScraperFunnel } =
    await import("../src/lib/services/close-mtd-funnel");

  const to = pacificToday();
  const from = `${to.slice(0, 7)}-01`;
  const [flow, calls, page] = await Promise.all([
    readRuleFlow(from, to),
    readCalls(from, to),
    getMarketingMtd(),
  ]);
  if (!flow.ok) throw new Error(flow.error);
  if (!calls.ok) throw new Error(calls.error);
  if (!page.ok) throw new Error(page.error);

  const kept = keptCalls(calls.data).filter((c) =>
    inRange(c.bookedDate, { startDay: from, endDay: to }),
  );
  // Scrapers by funnel, not by band: the flow moves a Google-click lead into
  // the Google Ads band (credit), so the bands alone would not split cleanly.
  const scrapers = kept.filter((c) => isScraperFunnel(c.funnel)).length;
  const sales =
    flow.data.bands.find((b) => b.key === "reactivation")?.values[1] ?? 0;
  console.log(
    `  (${scrapers - sales} Reactivation Scrapers calls credited to Google Ads by click)`,
  );
  const checks: Array<[string, number, number]> = [
    ["band total vs dashboard keptCalls", flow.data.totals[1], kept.length],
    [
      "total minus Reactivation Scrapers vs Marketing MTD booked",
      flow.data.totals[1] - scrapers,
      page.mtd.total.current.booked,
    ],
  ];

  console.log(`Booked by channel, ${from} to ${to}`);
  for (const b of flow.data.bands.filter((b) => b.values[1] > 0)) {
    console.log(`  ${b.label.padEnd(24)} ${String(b.values[1]).padStart(5)}`);
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
