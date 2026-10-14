import "server-only";

import { compare, type AuditResult } from "@/lib/services/data-audit";
import type { CloseMtdReport } from "@/lib/services/close-mtd-funnel-data";

const METRICS = [
  { key: "booked", label: "booked" },
  { key: "showed", label: "showed" },
  { key: "qualified", label: "qualified" },
  { key: "won", label: "closed won" },
  { key: "revenue", label: "revenue" },
] as const;

/**
 * Our month so far, cut to the company MTD dashboard's population, against the
 * numbers that dashboard publishes. "Ours" is the Months page's own loader, so
 * what is verified is the line on screen. Both sides refresh during the day
 * (MTD irregularly, our mirror hourly), so a call logged between the two runs
 * can differ by one; past 1% (or one call, whichever is more) the check warns,
 * past twice that it fails. An MTD build over two hours behind our mirror is
 * skipped, with its build time as the reason (compareWhenFresh).
 */
export async function companyMtdChecks(
  now: Date,
  loadMtd: (input: { now: Date }) => Promise<CloseMtdReport>,
): Promise<AuditResult[]> {
  const report = await loadMtd({ now });
  if (!report.ok) {
    throw new Error(`The month-to-date panel did not load: ${report.error}`);
  }
  const ours = report.funnel.companyView;
  const theirs = report.company.ok ? report.company.totals : null;
  const window = `${report.funnel.from} to ${report.funnel.to}`;
  const note = report.company.ok
    ? "Our copy of Close, limited to leads the MTD dashboard counts (Lane 1 roster owners, no other brands)."
    : report.company.error;
  return METRICS.map(({ key, label }) =>
    compare({
      checkId: `company-mtd-${key}`,
      label: `Company MTD dashboard: ${label}`,
      window,
      sourceName: "MTD dashboard",
      ours: ours[key],
      source: theirs ? theirs[key] : null,
      // One call either way always passes: 1% of 15 wins is not a call.
      tolerancePct:
        theirs && key !== "revenue" && theirs[key] > 0
          ? Math.max(1, 100 / theirs[key])
          : 1,
      unit: key === "revenue" ? "money" : "count",
      note,
    }),
  );
}
