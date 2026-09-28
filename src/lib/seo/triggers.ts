/**
 * Kody's 7 quick-win triggers, exactly as 05-task5-tracking-system.md section
 * 2 writes them. Pure: the weekly job reads the tables and calls this.
 *
 * Windows end on `asOf`, the newest day Search Console has final data for.
 * "Current" is the 28 days ending asOf, "prior" the 28 before. Page rules need
 * 100+ impressions in the current window, and never fire on a page Google
 * first showed less than 6 weeks ago (Kody: leave new pages alone).
 *
 * Scope: every page on www.vendingpreneurs.com except the home page and legal
 * pages, not only
 * /resources/ (none are live yet, and the /news/ pages hold the traffic).
 */

export type TriggerCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskType = "optimize" | "refresh" | "aeo_pairing";

export type DayRow = {
  day: string;
  impressions: number;
  clicks: number;
  position: number | null;
};
export type PageDayRow = DayRow & { page: string };
export type QueryDayRow = DayRow & { query: string; page: string };
/** One query, all pages together, one day (seo_gsc_query_totals_daily). */
export type QueryTotalRow = DayRow & { query: string };

export type RankRow = {
  day: string;
  keyword: string;
  vp_position: number | null;
  ai_overview: boolean;
  aio_cites_site: boolean;
  aio_cites_youtube: boolean;
  top10: Array<{
    rank: number;
    domain: string;
    url: string;
    date: string | null;
  }>;
};

export type TriggerHit = {
  code: TriggerCode;
  type: TaskType;
  priority: TaskPriority;
  /** The page the task is about, when there is one. */
  url: string | null;
  /** The keyword or query it fired on, when it fired on one. */
  subject: string | null;
  title: string;
  evidence: Record<string, number | string | boolean | null>;
};

export const TRIGGER_NAMES: Record<TriggerCode, string> = {
  1: "Striking distance",
  2: "Plateaued",
  3: "Slipping",
  4: "Declining",
  5: "New opportunity",
  6: "AI Overview without VP",
  7: "Competitor weakness",
};

/** The response column of the trigger table, shown on each task. */
export const PLAYBOOK: Record<TriggerCode, string> = {
  1: "Optimize for top 3: add the missing subtopics competitors cover, strengthen the answer-first intro, add 2 internal links from strong pages.",
  2: "Content refresh: a new section, updated data, and FAQ additions matching the new queries in Search Console.",
  3: "Run a live SERP scrape. Compare with whoever passed you. Check for technical changes (indexing, canonical, a deploy).",
  4: "Rule out technical issues first (indexing, canonical, deploy). Then check seasonality against last year's volume. Then treat it as content decay.",
  5: "Add it to tracking. If its intent differs from the page that ranks, create a new piece or H2.",
  6: "Make sure a page exists for it, add a 40-60 word definition answer, match heading wording to the video, add VideoObject and FAQPage schema.",
  7: "Create or upgrade the VP page to beat it on freshness, depth and operator economics.",
};

const FLOOR = 100;
const NEW_PAGE_DAYS = 42;
const SITE_HOST = "www.vendingpreneurs.com";
/** Pages nobody optimizes for search: legal and account pages. */
const EXCLUDED_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
  "/spam-policy",
  "/login",
]);

export function evaluateTriggers(input: {
  asOf: string;
  pageDays: PageDayRow[];
  /** Query totals: the thresholds read these. */
  queryTotals: QueryTotalRow[];
  /** Query + page rows: only used to name the page a query lands on. */
  queryDays: QueryDayRow[];
  /** Tracked keywords, lower case. */
  tracked: ReadonlySet<string>;
  isBrand: (query: string) => boolean;
  /** Snapshots from the last ~5 weeks, any order. */
  ranks: RankRow[];
  /** Tracked keyword -> the VP page meant to rank for it. */
  keywordPage: ReadonlyMap<string, string>;
}): TriggerHit[] {
  const { asOf } = input;
  const cur = window(asOf, 0, 28);
  const prior = window(asOf, 28, 28);
  const hits: TriggerHit[] = [];

  const byPage = groupBy(
    input.pageDays.filter((row) => inScope(row.page)),
    (row) => row.page,
  );
  for (const [page, rows] of byPage) {
    const firstSeen = rows.reduce(
      (min, r) => (r.day < min ? r.day : min),
      asOf,
    );
    if (daysBetween(firstSeen, asOf) < NEW_PAGE_DAYS) continue;
    const now = sum(rows, cur);
    if (now.impressions < FLOOR) continue;
    const before = sum(rows, prior);
    const growth = pct(now.impressions, before.impressions);
    const evidence = {
      position: round1(now.position),
      impressions28: now.impressions,
      impressionsPrior28: before.impressions,
      impressionsChangePct: growth === null ? null : round1(growth),
      clicks28: now.clicks,
    };

    // 1. Striking distance.
    if (
      now.position !== null &&
      now.position >= 4 &&
      now.position <= 10 &&
      growth !== null &&
      growth >= 20
    ) {
      hits.push(pageHit(1, "optimize", "high", page, evidence));
    }

    // 2. Plateaued: six full weeks, position flat, impressions up.
    const weeks = [5, 4, 3, 2, 1, 0].map((w) =>
      sum(rows, window(asOf, w * 7, 7)),
    );
    const firstHalf = weeks.slice(0, 3).reduce((s, w) => s + w.impressions, 0);
    const secondHalf = weeks.slice(3).reduce((s, w) => s + w.impressions, 0);
    const p0 = weeks[0].position;
    const p5 = weeks[5].position;
    const halfGrowth = pct(secondHalf, firstHalf);
    if (
      p0 !== null &&
      p5 !== null &&
      Math.abs(p5 - p0) < 1.5 &&
      halfGrowth !== null &&
      halfGrowth >= 15 &&
      now.position !== null &&
      now.position >= 4 &&
      now.position <= 20
    ) {
      hits.push(
        pageHit(2, "refresh", "medium", page, {
          ...evidence,
          positionSixWeeksAgo: round1(p0),
          positionLastWeek: round1(p5),
          impressionsChange3wPct: round1(halfGrowth),
        }),
      );
    }

    // 3. Slipping: 7-day average position 3+ worse than 14 days earlier.
    const last7 = sum(rows, window(asOf, 0, 7)).position;
    const then7 = sum(rows, window(asOf, 14, 7)).position;
    if (last7 !== null && then7 !== null && last7 - then7 >= 3) {
      hits.push(
        pageHit(3, "optimize", "urgent", page, {
          ...evidence,
          position7d: round1(last7),
          position7dTwoWeeksAgo: round1(then7),
        }),
      );
    }

    // 4. Declining: 14 days down 25%+ vs the 14 before, two weeks running.
    const drop = (offset: number) =>
      pct(
        sum(rows, window(asOf, offset, 14)).impressions,
        sum(rows, window(asOf, offset + 14, 14)).impressions,
      );
    const thisWeek = drop(0);
    const lastWeek = drop(7);
    if (
      thisWeek !== null &&
      lastWeek !== null &&
      thisWeek <= -25 &&
      lastWeek <= -25
    ) {
      hits.push(
        pageHit(4, "refresh", "high", page, {
          ...evidence,
          impressions14dChangePct: round1(thisWeek),
          impressions14dChangePctLastWeek: round1(lastWeek),
        }),
      );
    }
  }

  // 5. New opportunity: an untracked, non-brand query taking off.
  const byQuery = groupBy(input.queryTotals, (row) => row.query.toLowerCase());
  const pagesByQuery = groupBy(input.queryDays, (row) =>
    row.query.toLowerCase(),
  );
  for (const [query, rows] of byQuery) {
    if (input.tracked.has(query) || input.isBrand(query)) continue;
    const now = sum(rows, cur);
    if (now.impressions < 50) continue;
    const before = sum(rows, prior);
    const growth = pct(now.impressions, before.impressions);
    if (growth !== null && growth < 50) continue;
    const topPage = [
      ...groupBy(
        (pagesByQuery.get(query) ?? []).filter((r) => inWindow(r.day, cur)),
        (r) => r.page,
      ),
    ]
      .map(([page, pageRows]) => ({
        page,
        impressions: sum(pageRows, cur).impressions,
      }))
      .sort((a, b) => b.impressions - a.impressions)[0]?.page;
    hits.push({
      code: 5,
      type: "optimize",
      priority: "medium",
      url: topPage ?? null,
      subject: query,
      title: `${TRIGGER_NAMES[5]}: "${query}"`,
      evidence: {
        impressions28: now.impressions,
        impressionsPrior28: before.impressions,
        impressionsChangePct: growth === null ? null : round1(growth),
        position: round1(now.position),
      },
    });
  }

  // 3 (DataForSEO), 6 and 7 read the newest snapshot per keyword.
  const byKeyword = groupBy(input.ranks, (row) => row.keyword);
  for (const [keyword, rows] of byKeyword) {
    const sorted = [...rows].sort((a, b) => (a.day < b.day ? 1 : -1));
    const latest = sorted[0];
    const page = input.keywordPage.get(keyword) ?? null;
    const twoWeeksBack = sorted.find(
      (r) => daysBetween(r.day, latest.day) >= 14,
    );
    if (
      twoWeeksBack?.vp_position != null &&
      (latest.vp_position === null ||
        latest.vp_position - twoWeeksBack.vp_position >= 3)
    ) {
      hits.push({
        code: 3,
        type: "optimize",
        priority: "urgent",
        url: page,
        subject: keyword,
        title: `${TRIGGER_NAMES[3]}: "${keyword}"`,
        evidence: {
          rank: latest.vp_position,
          rankTwoWeeksAgo: twoWeeksBack.vp_position,
          checked: latest.day,
        },
      });
    }
    if (latest.ai_overview && !latest.aio_cites_site) {
      hits.push({
        code: 6,
        type: "aeo_pairing",
        priority: "high",
        url: page,
        subject: keyword,
        title: `${TRIGGER_NAMES[6]}: "${keyword}"`,
        evidence: {
          citesVpYouTube: latest.aio_cites_youtube,
          rank: latest.vp_position,
          checked: latest.day,
        },
      });
    }
    const vpInTop3 = latest.vp_position !== null && latest.vp_position <= 3;
    const stale = latest.top10
      .filter(
        (r) => r.rank <= 3 && r.date && monthsOld(r.date, latest.day) > 18,
      )
      .map((r) => r.domain);
    if (!vpInTop3 && stale.length > 0) {
      hits.push({
        code: 7,
        type: "optimize",
        priority: "medium",
        url: page,
        subject: keyword,
        title: `${TRIGGER_NAMES[7]}: "${keyword}"`,
        evidence: {
          staleTop3: stale.join(", "),
          rank: latest.vp_position,
          checked: latest.day,
        },
      });
    }
  }
  return hits;
}

function pageHit(
  code: TriggerCode,
  type: TaskType,
  priority: TaskPriority,
  page: string,
  evidence: TriggerHit["evidence"],
): TriggerHit {
  return {
    code,
    type,
    priority,
    url: page,
    subject: null,
    title: `${TRIGGER_NAMES[code]}: ${pathOf(page)}`,
    evidence,
  };
}

type Window = { from: string; to: string };

/** `length` days ending `offset` days before asOf (inclusive). */
export function window(asOf: string, offset: number, length: number): Window {
  const to = addDays(asOf, -offset);
  return { from: addDays(to, -(length - 1)), to };
}

function inWindow(day: string, w: Window): boolean {
  return day >= w.from && day <= w.to;
}

/** Totals over a window, position weighted by impressions. */
export function sum(rows: DayRow[], w: Window) {
  let impressions = 0;
  let clicks = 0;
  let weighted = 0;
  for (const row of rows) {
    if (!inWindow(row.day, w)) continue;
    impressions += row.impressions;
    clicks += row.clicks;
    if (row.position !== null) weighted += row.position * row.impressions;
  }
  return {
    impressions,
    clicks,
    position: impressions > 0 ? weighted / impressions : null,
  };
}

/** Percent change; null when there is nothing to compare against. */
function pct(now: number, before: number): number | null {
  if (before === 0) return now > 0 ? null : 0;
  return ((now - before) / before) * 100;
}

function inScope(page: string): boolean {
  try {
    const url = new URL(page);
    return url.hostname === SITE_HOST && !EXCLUDED_PATHS.has(url.pathname);
  } catch {
    // Search Console only reports absolute URLs; anything else is not a page.
    return false;
  }
}

function pathOf(page: string): string {
  try {
    return new URL(page).pathname;
  } catch {
    // Already a path.
    return page;
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function monthsOld(date: string, asOf: string): number {
  const then = Date.parse(date.replace(" +00:00", "Z").replace(" ", "T"));
  if (Number.isNaN(then)) return 0;
  return (Date.parse(`${asOf}T00:00:00Z`) - then) / (30.44 * 86_400_000);
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}
