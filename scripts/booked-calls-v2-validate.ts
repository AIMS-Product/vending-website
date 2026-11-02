/**
 * Our booked-call count against Dom's published MTD V2 archive for a month:
 * the mirror through `getBookedCallsV2`, read-only, by channel and bucket.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local \
 *     scripts/booked-calls-v2-validate.ts [YYYY-MM] (default: last full month)
 *
 * Exit 0 = within tolerance, 2 = differences past it (printed), 1 = error.
 * A closed month drifts a little by design: Dom freezes month-end lead owners,
 * we read today's. Only archives with `booking_scope` are comparable.
 */
import { pacificStartIso } from "../src/lib/services/data-report";
import { getBookedCallsV2 } from "../src/lib/services/booked-calls-v2-data";
import { RULE_VERSION } from "../src/lib/booked-calls-v2/rules";

const TOTAL_TOLERANCE = 0.02;
const CHANNEL_TOLERANCE = 2;
/** Total, then the three buckets: all held to the month-level tolerance. */
const BUCKET_ROWS = 4;
const ARCHIVE =
  "https://aims-product.github.io/mtd-funnel-dashboard/v2/archives";

type Archive = {
  rules_version: string;
  booking_scope?: string;
  generated_at: string;
  source_cutoff?: string;
  totals: {
    bookings: number;
    marketing: number;
    lane2: number;
    social_dms: number;
  };
  channels: Array<{ channel: string; bookings: number }>;
};

function lastFullMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 7);
}

async function main(): Promise<number> {
  const month = process.argv[2] ?? lastFullMonth();
  const res = await fetch(`${ARCHIVE}/data-${month}.json`);
  if (!res.ok) throw new Error(`Archive ${month}: HTTP ${res.status}`);
  const dom = (await res.json()) as Archive;
  if (!dom.booking_scope) {
    console.error(`${month} has no booking_scope: an all-owner snapshot.`);
    return 1;
  }

  const cutoff = Date.parse(dom.source_cutoff ?? dom.generated_at);
  const monthEnd = Date.parse(pacificStartIso(`${nextMonth(month)}-01`));
  const report = await getBookedCallsV2({
    from: pacificStartIso(`${month}-01`),
    to: new Date(Math.min(cutoff, monthEnd)).toISOString(),
  });
  if (!report.ok) throw new Error(report.error);

  const { summary } = report;
  console.log(`Rules: ours ${RULE_VERSION}\n       Dom  ${dom.rules_version}`);
  const rows: Array<[string, number, number]> = [
    ["Total", summary.counted, dom.totals.bookings],
    ["Marketing", summary.byBookedBy.Marketing, dom.totals.marketing],
    ["Lane 2", summary.byBookedBy["Lane 2"], dom.totals.lane2],
    ["Social DMs", summary.byBookedBy["Social DMs"], dom.totals.social_dms],
  ];
  const channels = new Set([
    ...Object.keys(summary.byOrigin),
    ...dom.channels.filter((c) => c.bookings).map((c) => c.channel),
  ]);
  for (const channel of [...channels].sort()) {
    const ours = Object.values(summary.byOrigin[channel] ?? {}).reduce(
      (sum, n) => sum + (n ?? 0),
      0,
    );
    const theirs =
      dom.channels.find((c) => c.channel === channel)?.bookings ?? 0;
    rows.push([channel, ours, theirs]);
  }

  let failed = RULE_VERSION !== dom.rules_version;
  if (failed) console.log("Rule versions differ.");
  const totalLimit = Math.ceil(dom.totals.bookings * TOTAL_TOLERANCE);
  for (const [i, [label, ours, theirs]] of rows.entries()) {
    const limit = i < BUCKET_ROWS ? totalLimit : CHANNEL_TOLERANCE;
    const over = Math.abs(ours - theirs) > limit;
    failed ||= over;
    console.log(
      `${over ? "OVER" : "ok  "} ${label.padEnd(26)} ours ${String(ours).padStart(4)}  Dom ${String(theirs).padStart(4)}`,
    );
  }
  return failed ? 2 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
