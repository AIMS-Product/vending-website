/**
 * Prove the Channels page and KPI export count what the Months V2 panel
 * counts: Dom's booked_calls.v2.2, by channel band, for a window.
 * Read-only; runs the page's own loaders.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/channels-dom-rule-validate.ts [from] [to]
 *
 * Default window: this month to today (Pacific). Exit 0 = the band total
 * equals V2 counted and the Lane 2 & Social DMs band equals those two
 * buckets; 2 = differences (printed); 1 = error.
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

async function main() {
  const { pacificToday } = await import("../src/lib/admin/format-time");
  const { getBookedCallsV2 } =
    await import("../src/lib/services/booked-calls-v2-data");
  const { pacificStartIso } = await import("../src/lib/services/data-report");
  const { buildChannelFlow } =
    await import("../src/lib/analytics/channel-flow");
  const { inRange } = await import("../src/lib/analytics/dashboard-metrics");
  const { readCalls } =
    await import("../src/lib/services/analytics-dashboard-data");

  const today = pacificToday();
  const from = process.argv[2] ?? `${today.slice(0, 7)}-01`;
  const to = process.argv[3] ?? today;
  const next = new Date(`${to}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);

  const [calls, panel] = await Promise.all([
    readCalls(from, to),
    getBookedCallsV2({
      from: pacificStartIso(from),
      to: pacificStartIso(next.toISOString().slice(0, 10)),
    }),
  ]);
  if (!calls.ok) throw new Error(calls.error);
  if (!panel.ok) throw new Error(panel.error);

  const flow = buildChannelFlow({
    calls: calls.data.filter((c) =>
      inRange(c.bookedDate, { startDay: from, endDay: to }),
    ),
    captured: [],
    wins: [],
  });
  const sales =
    flow.bands.find((b) => b.key === "reactivation")?.values[1] ?? 0;
  const s = panel.summary.byBookedBy;
  const checks: Array<[string, number, number]> = [
    ["counted", flow.totals[1], panel.summary.counted],
    ["Lane 2 + Social DMs", sales, (s["Lane 2"] ?? 0) + (s["Social DMs"] ?? 0)],
    ["Marketing", flow.totals[1] - sales, s.Marketing ?? 0],
  ];

  console.log(`Channels on Dom's rule, ${from} to ${to}`);
  for (const b of flow.bands.filter((b) => b.values[1] > 0)) {
    console.log(`  ${b.label.padEnd(24)} ${String(b.values[1]).padStart(5)}`);
  }
  let diffs = 0;
  for (const [label, ours, v2] of checks) {
    const ok = ours === v2;
    if (!ok) diffs += 1;
    console.log(
      `${ok ? "ok  " : "DIFF"} ${label}: channels ${ours} / V2 panel ${v2}`,
    );
  }
  process.exit(diffs === 0 ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
