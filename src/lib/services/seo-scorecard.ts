import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTable } from "@/lib/seo/db";
import { addDays, sum, window, type DayRow } from "@/lib/seo/triggers";
import { readAllPages } from "@/lib/services/paged-read";
import type { Database } from "@/types/database";

/**
 * The SEO scorecard: the metrics frozen as Day 0 in seo_baselines
 * (scripts/seo-day0.mjs) and recomputed live for the Overview and the EOW
 * email. Search numbers come from the Search Console tables over the 28 days
 * ending the newest final day; rank numbers from the newest DataForSEO pull.
 */

type Client = Pick<SupabaseClient<Database>, "from">;

export type ScorecardMetric =
  | "nonbrand_impressions_7d"
  | "nonbrand_impressions_28d"
  | "nonbrand_clicks_28d"
  | "brand_impressions_28d"
  | "impressions_28d"
  | "clicks_28d"
  | "pages_with_impressions_28d"
  | "queries_top3"
  | "queries_4_10"
  | "queries_11_20"
  | "keywords_checked"
  | "keywords_top10"
  | "keywords_top3"
  | "aio_keywords"
  | "aio_cites_site"
  | "aio_cites_youtube"
  | "resources_live"
  | "resources_indexed"
  | "indexed_urls"
  | "ga4_organic_sessions_28d"
  | "ga4_organic_key_events_28d"
  | "organic_booked_calls_28d";

export type MetricValues = Partial<Record<ScorecardMetric, number>>;

export type ScorecardRow = {
  metric: ScorecardMetric;
  label: string;
  /** Targets at +30, +60 and +90 days from Day 0 (absolute values). */
  targets: [number, number, number] | null;
  note?: string;
};

/**
 * Targets, set 2026-09-28 from Day 0 plus the P1 plan (17 pieces at 3-4 a
 * week from week 1; new pages take 4-8 weeks to earn impressions, so most of
 * the lift lands in the 60 and 90 day marks). docs/marketing/seo-baseline-2026-09-29.md
 * section 5 shows the working.
 */
export const SCORECARD: ScorecardRow[] = [
  {
    metric: "nonbrand_impressions_7d",
    label: "Non-branded impressions per week (north star)",
    targets: [1_400, 2_500, 4_500],
  },
  {
    metric: "nonbrand_clicks_28d",
    label: "Non-branded clicks, 28 days",
    targets: [300, 400, 600],
  },
  {
    metric: "keywords_top10",
    label: "Tracked keywords in the top 10",
    targets: [2, 8, 20],
    note: "DataForSEO, of the 224 tracked",
  },
  {
    metric: "keywords_top3",
    label: "Tracked keywords in the top 3",
    targets: [0, 2, 6],
  },
  {
    metric: "aio_cites_site",
    label: "AI Overviews citing vendingpreneurs.com",
    targets: [1, 5, 12],
  },
  {
    metric: "resources_live",
    label: "Live /resources pages",
    targets: [14, 19, 25],
  },
  {
    metric: "resources_indexed",
    label: "Indexed /resources pages",
    targets: [10, 17, 23],
  },
  {
    metric: "organic_booked_calls_28d",
    label: "Organic booked calls, 28 days",
    targets: null,
    note: "Needs the /booking-seo variant (open technical task)",
  },
];

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Queries by impression-weighted position over the window, bucketed. */
export function positionBuckets(
  rows: Array<DayRow & { query: string }>,
  from: string,
  to: string,
) {
  const byQuery = new Map<string, DayRow[]>();
  for (const r of rows) {
    const list = byQuery.get(r.query) ?? [];
    list.push(r);
    byQuery.set(r.query, list);
  }
  let top3 = 0;
  let mid = 0;
  let second = 0;
  for (const list of byQuery.values()) {
    const p = sum(list, { from, to }).position;
    if (p === null) continue;
    const rounded = round1(p);
    if (rounded <= 3) top3 += 1;
    else if (rounded <= 10) mid += 1;
    else if (rounded <= 20) second += 1;
  }
  return { queries_top3: top3, queries_4_10: mid, queries_11_20: second };
}

type Snap = {
  day: string;
  keyword: string;
  vp_position: number | null;
  ai_overview: boolean;
  aio_cites_site: boolean;
  aio_cites_youtube: boolean;
};

/** The newest snapshot per keyword, counted. */
export function rankCounts(snaps: Snap[]): MetricValues {
  const latest = new Map<string, Snap>();
  for (const s of snaps) {
    const k = s.keyword.toLowerCase();
    const seen = latest.get(k);
    if (!seen || seen.day < s.day) latest.set(k, s);
  }
  const list = [...latest.values()];
  const count = (f: (s: Snap) => boolean) => list.filter(f).length;
  return {
    keywords_checked: list.length,
    keywords_top10: count((s) => s.vp_position !== null && s.vp_position <= 10),
    keywords_top3: count((s) => s.vp_position !== null && s.vp_position <= 3),
    aio_keywords: count((s) => s.ai_overview),
    aio_cites_site: count((s) => s.ai_overview && s.aio_cites_site),
    aio_cites_youtube: count((s) => s.ai_overview && s.aio_cites_youtube),
  };
}

function check(what: string, error: { message: string } | null) {
  if (error) {
    console.error(`seo scorecard read failed: ${what}`, {
      message: error.message,
    });
    throw new Error(`Could not read ${what}.`);
  }
}

/** Every metric the database can answer, as of the newest Search Console day. */
export async function readScorecardMetrics(
  client: Client,
): Promise<{ asOf: string | null; values: MetricValues }> {
  const daily = await client
    .from("seo_gsc_daily")
    .select("day, clicks, impressions, brand_clicks, brand_impressions")
    .order("day", { ascending: false })
    .limit(28);
  if (isMissingTable(daily.error)) return { asOf: null, values: {} };
  check("Search Console daily totals", daily.error);
  const days = daily.data ?? [];
  const asOf = days[0]?.day ?? null;
  if (!asOf) return { asOf, values: {} };
  const w28 = window(asOf, 0, 28);
  const w7 = window(asOf, 0, 7);
  const add = (from: string, pick: (d: (typeof days)[number]) => number) =>
    days.filter((d) => d.day >= from).reduce((s, d) => s + pick(d), 0);
  const impressions = add(w28.from, (d) => d.impressions);
  const clicks = add(w28.from, (d) => d.clicks);
  const brandImpr = add(w28.from, (d) => d.brand_impressions);
  const brandClicks = add(w28.from, (d) => d.brand_clicks);

  const [pages, queries, snaps, live] = await Promise.all([
    readAllPages<{ page: string; impressions: number }>((from, to, count) =>
      client
        .from("seo_gsc_page_daily")
        .select("page, impressions", { count })
        .gte("day", w28.from)
        .lte("day", w28.to)
        .gt("impressions", 0)
        .order("day")
        .order("page")
        .range(from, to),
    ),
    readAllPages<{
      day: string;
      query: string;
      impressions: number;
      clicks: number;
      position: number | string | null;
    }>((from, to, count) =>
      client
        .from("seo_gsc_query_totals_daily")
        .select("day, query, impressions, clicks, position", { count })
        .gte("day", w28.from)
        .lte("day", w28.to)
        .order("day")
        .order("query")
        .range(from, to),
    ),
    readAllPages<Snap>((from, to, count) =>
      client
        .from("seo_rank_snapshots")
        .select(
          "day, keyword, vp_position, ai_overview, aio_cites_site, aio_cites_youtube",
          { count },
        )
        .gte("day", addDays(asOf, -21))
        .order("day")
        .order("keyword")
        .range(from, to),
    ),
    client
      .from("seo_pages")
      .select("route_path", { count: "exact", head: true })
      .eq("status", "published")
      .like("route_path", "/resources/%"),
  ]);
  check("Search Console pages", pages.error);
  check("Search Console queries", queries.error);
  check("rank snapshots", snaps.error);
  check("published /resources pages", live.error);

  return {
    asOf,
    values: {
      nonbrand_impressions_7d:
        add(w7.from, (d) => d.impressions) -
        add(w7.from, (d) => d.brand_impressions),
      nonbrand_impressions_28d: impressions - brandImpr,
      nonbrand_clicks_28d: clicks - brandClicks,
      brand_impressions_28d: brandImpr,
      impressions_28d: impressions,
      clicks_28d: clicks,
      pages_with_impressions_28d: new Set(pages.rows.map((r) => r.page)).size,
      ...positionBuckets(
        queries.rows.map((r) => ({
          ...r,
          query: r.query.toLowerCase(),
          position: r.position === null ? null : Number(r.position),
        })),
        w28.from,
        w28.to,
      ),
      ...rankCounts(snaps.rows),
      resources_live: live.count ?? 0,
    },
  };
}

export type Day0 = { day: string; values: MetricValues };

/** The earliest frozen baseline, or null before the table or the seed exists. */
export async function readDay0(client: Client): Promise<Day0 | null> {
  const first = await client
    .from("seo_baselines")
    .select("day")
    .order("day")
    .limit(1);
  // The migration has not been pasted yet: no baseline, not a failure.
  if (isMissingTable(first.error)) return null;
  check("SEO Day 0 baseline", first.error);
  const day = first.data?.[0]?.day;
  if (!day) return null;
  const rows = await client
    .from("seo_baselines")
    .select("metric, value")
    .eq("day", day);
  check("SEO Day 0 baseline", rows.error);
  const values: MetricValues = {};
  for (const r of rows.data ?? []) {
    if (r.value !== null) values[r.metric as ScorecardMetric] = Number(r.value);
  }
  return { day, values };
}

export type SeoScorecard = {
  asOf: string | null;
  day0: Day0 | null;
  current: MetricValues;
  rows: ScorecardRow[];
};

/** Overview + EOW email: Day 0, now, and the 30/60/90 day targets. */
export async function getSeoScorecard(client: Client): Promise<SeoScorecard> {
  const [day0, now] = await Promise.all([
    readDay0(client),
    readScorecardMetrics(client),
  ]);
  return { asOf: now.asOf, day0, current: now.values, rows: SCORECARD };
}
