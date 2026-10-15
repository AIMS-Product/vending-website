/**
 * Prove the Marketing MTD page counts what Jess's marketing-mtd-dashboard.html
 * counts (snapshot 2026-10-15 15:28 UTC): per channel, Oct 1-15 and Sep 1-15.
 * Read-only; runs the page's own loader as of her snapshot.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/marketing-mtd-validate.ts [jess.html]
 *
 * With her HTML file, also lists every booked lead or won deal on one side
 * only, so a gap can be traced to a Close edit made after her snapshot.
 * Exit 0 = every figure equal, 2 = differences (printed), 1 = error.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";

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

const SNAPSHOT = new Date("2026-10-15T15:28:07Z");

type Figures = {
  booked: number;
  showed: number;
  qualified_shown: number;
  closed: number;
  revenue: number;
};

/** Jess's report-data, per channel (her "Unknown (Needs Review)" = ours). */
const JESS: Record<"current" | "prior", Record<string, Figures>> = {
  current: {
    Instagram: {
      booked: 8,
      showed: 6,
      qualified_shown: 6,
      closed: 0,
      revenue: 0,
    },
    Website: {
      booked: 11,
      showed: 6,
      qualified_shown: 2,
      closed: 0,
      revenue: 0,
    },
    "Internal Webinar": {
      booked: 77,
      showed: 43,
      qualified_shown: 30,
      closed: 7,
      revenue: 54235,
    },
    YouTube: {
      booked: 18,
      showed: 11,
      qualified_shown: 10,
      closed: 3,
      revenue: 24241,
    },
    "Unknown (Needs Review)": {
      booked: 8,
      showed: 5,
      qualified_shown: 4,
      closed: 0,
      revenue: 0,
    },
    "Google Ads": {
      booked: 8,
      showed: 4,
      qualified_shown: 3,
      closed: 1,
      revenue: 5997,
    },
    LinkedIn: {
      booked: 2,
      showed: 2,
      qualified_shown: 2,
      closed: 0,
      revenue: 0,
    },
    WWWS: { booked: 1, showed: 1, qualified_shown: 1, closed: 0, revenue: 0 },
    "LTF - In-House": {
      booked: 1,
      showed: 1,
      qualified_shown: 0,
      closed: 1,
      revenue: 1200,
    },
  },
  prior: {
    Instagram: {
      booked: 28,
      showed: 20,
      qualified_shown: 13,
      closed: 3,
      revenue: 14082,
    },
    Website: {
      booked: 22,
      showed: 15,
      qualified_shown: 13,
      closed: 1,
      revenue: 6897,
    },
    "Internal Webinar": {
      booked: 71,
      showed: 42,
      qualified_shown: 29,
      closed: 3,
      revenue: 25994,
    },
    "Meta Ads": {
      booked: 1,
      showed: 0,
      qualified_shown: 0,
      closed: 0,
      revenue: 0,
    },
    YouTube: {
      booked: 14,
      showed: 8,
      qualified_shown: 7,
      closed: 7,
      revenue: 49470,
    },
    LinkedIn: {
      booked: 4,
      showed: 3,
      qualified_shown: 2,
      closed: 0,
      revenue: 0,
    },
    "Google Ads": {
      booked: 14,
      showed: 10,
      qualified_shown: 5,
      closed: 0,
      revenue: 0,
    },
    "Unknown (Needs Review)": {
      booked: 2,
      showed: 0,
      qualified_shown: 0,
      closed: 1,
      revenue: 5997,
    },
    "Mike Newsletter": {
      booked: 1,
      showed: 1,
      qualified_shown: 1,
      closed: 0,
      revenue: 0,
    },
    "LTF - In-House": {
      booked: 2,
      showed: 0,
      qualified_shown: 0,
      closed: 2,
      revenue: 11535,
    },
  },
};
/** Her headline extras: open calls (Oct) and median cycle days. */
const JESS_OPEN = 8;
const JESS_CYCLE = { current: 5, prior: 10 };

type JessPerson = {
  id: string;
  name: string;
  booked: boolean;
  booked_date: string | null;
  shown: string;
  qualified: string;
  mtd_won_count: number;
};

async function main() {
  const { getMarketingMtd } =
    await import("../src/lib/services/marketing-mtd-data");
  const { median } = await import("../src/lib/services/marketing-mtd");
  const page = await getMarketingMtd({ now: SNAPSHOT });
  if (!page.ok) throw new Error(`Marketing MTD read failed: ${page.error}`);
  const { mtd } = page;

  const diffs: string[] = [];
  const check = (label: string, ours: number, theirs: number) => {
    const same = Math.round(ours) === Math.round(theirs);
    if (!same) diffs.push(label);
    if (ours || theirs)
      console.log(
        `${same ? "  ok  " : "  DIFF"} ${label}: page ${ours}, Jess ${theirs}`,
      );
  };

  for (const period of ["current", "prior"] as const) {
    const range = mtd[period];
    console.log(`\n${range.from}..${range.to}`);
    const labels = new Set([
      ...Object.keys(JESS[period]),
      ...mtd.rows.map((r) => r.label),
    ]);
    const total = {
      booked: 0,
      showed: 0,
      qualified_shown: 0,
      closed: 0,
      revenue: 0,
    };
    for (const label of [...labels].sort()) {
      const ours = mtd.rows.find((r) => r.label === label)?.[period];
      const theirs = JESS[period][label];
      for (const [key, pick] of [
        ["booked", (f: NonNullable<typeof ours>) => f.booked],
        ["showed", (f: NonNullable<typeof ours>) => f.shown],
        ["qualified_shown", (f: NonNullable<typeof ours>) => f.qualified],
        ["closed", (f: NonNullable<typeof ours>) => f.won],
        ["revenue", (f: NonNullable<typeof ours>) => f.revenue],
      ] as const) {
        total[key] += theirs?.[key] ?? 0;
        check(`${label} · ${key}`, ours ? pick(ours) : 0, theirs?.[key] ?? 0);
      }
    }
    const t = mtd.total[period];
    check("TOTAL booked", t.booked, total.booked);
    check("TOTAL won", t.won, total.closed);
    check("TOTAL revenue", t.revenue, total.revenue);
    check("median cycle days", median(t.cycleDays) ?? 0, JESS_CYCLE[period]);
    if (period === "current") check("open calls", t.open, JESS_OPEN);
  }

  const htmlPath = process.argv[2];
  if (htmlPath) {
    const html = readFileSync(htmlPath, "utf8");
    const json = html.match(
      /<script[^>]*id="people-data"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1];
    if (!json) throw new Error("No people-data block in that file.");
    const people = Object.values(
      JSON.parse(json).sources as Record<string, JessPerson[]>,
    ).flat();
    const theirs = new Set(people.filter((p) => p.booked).map((p) => p.id));
    const ours = new Map(page.mtd.leads.map((l) => [l.leadId, l] as const));
    console.log("\nOctober booked leads on one side only:");
    for (const p of people.filter((p) => p.booked && !ours.has(p.id)))
      console.log(`  Jess only: ${p.name} (${p.id}) booked ${p.booked_date}`);
    for (const l of ours.values())
      if (!theirs.has(l.leadId))
        console.log(
          `  page only: ${l.name ?? "?"} (${l.leadId}) booked ${l.bookedDate} · ${l.channel}`,
        );
    const jessWon = new Set(
      people.filter((p) => p.mtd_won_count > 0).map((p) => p.id),
    );
    console.log("October won deals on one side only:");
    for (const w of page.mtd.wins)
      if (!jessWon.has(w.leadId))
        console.log(
          `  page only: ${w.leadId} won ${w.dateWon} $${w.value} · ${w.channel} · ${w.closer}`,
        );
    const ourWon = new Set(page.mtd.wins.map((w) => w.leadId));
    for (const p of people.filter(
      (p) => p.mtd_won_count > 0 && !ourWon.has(p.id),
    ))
      console.log(`  Jess only: ${p.name} (${p.id})`);
  }

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
