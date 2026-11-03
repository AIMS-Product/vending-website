import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { pacificToday } from "@/lib/admin/format-time";
import {
  BOOKING_SCOPE,
  RULE_CONFIG_SHA,
  RULE_VERSION,
  VP_BOOKING_CLOSERS,
} from "@/lib/booked-calls-v2/rules";
import { getBookedCallsV2 } from "@/lib/services/booked-calls-v2-data";
import {
  assertion,
  compare,
  type AuditResult,
} from "@/lib/services/data-audit";
import { pacificStartIso } from "@/lib/services/data-report";

const V2_URL = "https://aims-product.github.io/mtd-funnel-dashboard/v2";
/** Past this, our hourly mirror and his build are not the same moment. */
const MAX_ARCHIVE_LAG_MS = 2 * 60 * 60 * 1000;

const archiveSchema = z.object({
  rules_version: z.string(),
  booking_scope: z.string().optional(),
  generated_at: z.string(),
  totals: z.object({ bookings: z.number() }),
});

export type DomV2Read = {
  rulesJson: string;
  aggregatesPy: string;
  /** Null until his build has written this month's file. */
  archive: z.infer<typeof archiveSchema> | null;
};

async function text(path: string): Promise<Response> {
  return fetch(`${V2_URL}/${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

async function requiredText(path: string): Promise<string> {
  const response = await text(path);
  if (!response.ok)
    throw new Error(`Dom's ${path} answered ${response.status}.`);
  return response.text();
}

export async function readDomV2(month: string): Promise<DomV2Read> {
  const [rulesJson, aggregatesPy, archive] = await Promise.all([
    requiredText("rules.json"),
    requiredText("aggregates.py"),
    text(`archives/data-${month}.json`),
  ]);
  return {
    rulesJson,
    aggregatesPy,
    archive: archive.ok ? archiveSchema.parse(await archive.json()) : null,
  };
}

/** The closers in his `VP_BOOKING_CLOSERS` tuple, lowercased and sorted. */
export function rosterIn(aggregatesPy: string): string[] {
  const tuple = /VP_BOOKING_CLOSERS\s*=\s*\(([^)]*)\)/.exec(aggregatesPy)?.[1];
  return [...(tuple ?? "").matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]!.toLowerCase())
    .sort();
}

/**
 * Our copy of Dom's booked-call rules against what he publishes. His rules
 * moved three times in October and November while our count quietly drifted, so
 * a changed rules file or closer roster fails here rather than waiting for
 * someone to notice a number. A roster we cannot read fails too: he may have
 * moved it, and it is the one rule that is not in `rules.json`.
 */
export async function domRulesChecks(
  now: Date,
  read: (month: string) => Promise<DomV2Read> = readDomV2,
  loadBooked: typeof getBookedCallsV2 = getBookedCallsV2,
): Promise<AuditResult[]> {
  const month = pacificToday(now).slice(0, 7);
  const dom = await read(month);
  const window = `published ${month}`;
  const sourceName = "Dom's MTD V2";

  const sha = createHash("sha256").update(dom.rulesJson).digest("hex");
  const roster = rosterIn(dom.aggregatesPy);
  const ours = [...VP_BOOKING_CLOSERS].sort();
  const scope = dom.archive?.booking_scope;
  const results = [
    assertion({
      checkId: "company-mtd-v2-rules",
      label: "Dom's MTD V2: title rules match our copy",
      window,
      sourceName,
      ok: sha === RULE_CONFIG_SHA,
      detail:
        sha === RULE_CONFIG_SHA
          ? `Same rules.json as ${RULE_VERSION}.`
          : `His rules.json changed; ours is ${RULE_VERSION}. Copy it to src/lib/booked-calls-v2 and run scripts/booked-calls-v2-validate.ts.`,
    }),
    assertion({
      checkId: "company-mtd-v2-scope",
      label: "Dom's MTD V2: VP closer roster and scope match our copy",
      window,
      sourceName,
      ok: roster.join() === ours.join() && (!scope || scope === BOOKING_SCOPE),
      count: roster.length,
      detail:
        roster.join() !== ours.join()
          ? "His VP_BOOKING_CLOSERS in aggregates.py differs from ours, or could not be read."
          : scope && scope !== BOOKING_SCOPE
            ? `He publishes scope ${scope}; ours is ${BOOKING_SCOPE}.`
            : `${roster.length} closers, scope ${BOOKING_SCOPE}.`,
    }),
  ];

  const archive = dom.archive;
  const builtAt = archive ? Date.parse(archive.generated_at) : NaN;
  const fresh =
    Number.isFinite(builtAt) && now.getTime() - builtAt <= MAX_ARCHIVE_LAG_MS;
  const report = fresh
    ? await loadBooked({
        from: pacificStartIso(`${month}-01`),
        to: new Date(builtAt).toISOString(),
      })
    : null;
  if (report && !report.ok) throw new Error(report.error);
  const source = report?.ok && archive ? archive.totals.bookings : null;
  results.push(
    compare({
      checkId: "company-mtd-v2-booked",
      label: "Dom's MTD V2: booked calls",
      window: `${month} to his last build`,
      sourceName,
      ours: report?.ok ? report.summary.counted : null,
      source,
      // Our mirror is up to an hour behind his build: one call always passes.
      tolerancePct: source ? Math.max(1, 100 / source) : 1,
      note: archive
        ? `His last build ${archive.generated_at}.`
        : "He has not published this month yet.",
    }),
  );
  return results;
}
