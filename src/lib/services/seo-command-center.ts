import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isBrandQuery } from "@/lib/seo/brand";
import { isMissingTable } from "@/lib/seo/db";
import { addDays, sum, window, type DayRow } from "@/lib/seo/triggers";
import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Everything /admin/seo's Overview, Pages, Keywords and Social tabs read.
 * Tables: seo_gsc_daily, seo_gsc_page_daily, seo_gsc_query_daily,
 * seo_keywords, seo_rank_snapshots, social_account_daily, seo_pages.
 * Each loader says `missing` instead of throwing while the SEO migration has
 * not been pasted, so the page renders its setup note.
 */

type Client = Pick<SupabaseClient<Database>, "from">;
export const CUTOVER_DAY = "2026-07-27";
const SITE = "https://www.vendingpreneurs.com";

export type Missing = { missing: true };
const MISSING: Missing = { missing: true };

function fail(what: string, error: { message: string }): never {
  console.error(`seo command center read failed: ${what}`, {
    message: error.message,
  });
  throw new Error(`Could not read ${what}.`);
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

// ---------------------------------------------------------------- Overview

export type DailyPoint = {
  day: string;
  impressions: number;
  clicks: number;
  position: number | null;
  brandImpressions: number;
};

export type Totals = {
  impressions: number;
  clicks: number;
  ctrPct: number | null;
  position: number | null;
};

export type Mover = {
  key: string;
  impressions: number;
  priorImpressions: number;
  change: number;
  position: number | null;
};

export type SeoOverview = {
  missing: false;
  daily: DailyPoint[];
  asOf: string | null;
  current: Totals;
  prior: Totals;
  lastYear: Totals | null;
  brandShareCurrent: number | null;
  markers: Array<{ day: string; label: string }>;
  livePagesByDay: Array<{ day: string; count: number }>;
  movers: { pages: Mover[]; queries: Mover[] };
};

export async function getSeoOverview(
  deps: { client?: Client } = {},
): Promise<SeoOverview | Missing> {
  const client = deps.client ?? createAdminClient();
  const daily = await client
    .from("seo_gsc_daily")
    .select("day, clicks, impressions, position, brand_impressions")
    .order("day")
    .limit(1000);
  if (isMissingTable(daily.error)) return MISSING;
  if (daily.error) fail("Search Console daily totals", daily.error);
  const points: DailyPoint[] = (daily.data ?? []).map((r) => ({
    day: r.day,
    impressions: r.impressions,
    clicks: r.clicks,
    position: num(r.position),
    brandImpressions: r.brand_impressions,
  }));
  const asOf = points.at(-1)?.day ?? null;
  const rows: DayRow[] = points;
  const totals = (from: number, len = 28): Totals | null => {
    if (!asOf) return null;
    const w = window(asOf, from, len);
    if (points[0] && points[0].day > w.from) return null;
    const s = sum(rows, w);
    return {
      impressions: s.impressions,
      clicks: s.clicks,
      ctrPct: s.impressions ? (s.clicks / s.impressions) * 100 : null,
      position: s.position,
    };
  };
  const empty: Totals = {
    impressions: 0,
    clicks: 0,
    ctrPct: null,
    position: null,
  };
  const current = totals(0) ?? empty;
  const curWindow = asOf ? window(asOf, 0, 28) : null;
  const brandCur = curWindow
    ? points
        .filter((p) => p.day >= curWindow.from && p.day <= curWindow.to)
        .reduce((s, p) => s + p.brandImpressions, 0)
    : 0;

  const [pages, movers] = await Promise.all([
    readLiveResourcePages(client),
    asOf
      ? readMovers(client, asOf)
      : Promise.resolve({ pages: [], queries: [] }),
  ]);
  const markers = [
    { day: CUTOVER_DAY, label: "Webflow to Next.js" },
    ...pages.map((p) => ({ day: p.day, label: `Published ${p.path}` })),
  ];
  let running = 0;
  const livePagesByDay = pages.map((p) => ({ day: p.day, count: ++running }));

  return {
    missing: false,
    daily: points,
    asOf,
    current,
    prior: totals(28) ?? empty,
    lastYear: totals(364),
    brandShareCurrent: current.impressions
      ? brandCur / current.impressions
      : null,
    markers,
    livePagesByDay,
    movers,
  };
}

async function readLiveResourcePages(client: Client) {
  const { data, error } = await client
    .from("seo_pages")
    .select("route_path, published_at")
    .eq("status", "published")
    .like("route_path", "/resources/%")
    .not("published_at", "is", null)
    .order("published_at");
  if (error) fail("published /resources pages", error);
  return (data ?? []).map((p) => ({
    path: p.route_path,
    day: String(p.published_at).slice(0, 10),
  }));
}

async function readMovers(client: Client, asOf: string) {
  const since = addDays(asOf, -55);
  const [pages, queries] = await Promise.all([
    readAllPages<{
      day: string;
      page: string;
      impressions: number;
      clicks: number;
      position: string | number | null;
    }>((from, to, count) =>
      client
        .from("seo_gsc_page_daily")
        .select("day, page, impressions, clicks, position", { count })
        .gte("day", since)
        .order("day")
        .order("page")
        .range(from, to),
    ),
    readAllPages<{
      day: string;
      query: string;
      impressions: number;
      clicks: number;
      position: string | number | null;
    }>((from, to, count) =>
      client
        .from("seo_gsc_query_daily")
        .select("day, query, impressions, clicks, position", { count })
        .gte("day", since)
        .order("day")
        .order("query")
        .order("page")
        .range(from, to),
    ),
  ]);
  if (pages.error) fail("Search Console pages", pages.error);
  if (queries.error) fail("Search Console queries", queries.error);
  const rank = (rows: Array<DayRow & { key: string }>) => {
    const by = new Map<string, DayRow[]>();
    for (const r of rows) by.set(r.key, [...(by.get(r.key) ?? []), r]);
    return [...by]
      .map(([key, list]) => {
        const cur = sum(list, window(asOf, 0, 28));
        const pri = sum(list, window(asOf, 28, 28));
        return {
          key,
          impressions: cur.impressions,
          priorImpressions: pri.impressions,
          change: cur.impressions - pri.impressions,
          position: cur.position,
        };
      })
      .filter((m) => m.impressions + m.priorImpressions >= 20)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 8);
  };
  return {
    pages: rank(
      pages.rows.map((r) => ({
        ...r,
        key: pathOf(r.page),
        position: num(r.position),
      })),
    ),
    queries: rank(
      queries.rows.map((r) => ({
        ...r,
        key: r.query,
        position: num(r.position),
      })),
    ),
  };
}

// ------------------------------------------------------------------- Pages

export type PageRow = {
  url: string;
  path: string;
  current: Totals;
  prior: Totals;
  weekly: number[];
  cmsPageId: string | null;
  firstSeen: string;
};

export async function getSeoPages(
  deps: { client?: Client } = {},
): Promise<
  { missing: false; asOf: string | null; pages: PageRow[] } | Missing
> {
  const client = deps.client ?? createAdminClient();
  const latest = await client
    .from("seo_gsc_page_daily")
    .select("day")
    .order("day", { ascending: false })
    .limit(1);
  if (isMissingTable(latest.error)) return MISSING;
  if (latest.error) fail("Search Console pages", latest.error);
  const asOf = latest.data?.[0]?.day ?? null;
  if (!asOf) return { missing: false, asOf, pages: [] };

  const [rows, cms] = await Promise.all([
    readAllPages<{
      day: string;
      page: string;
      impressions: number;
      clicks: number;
      position: string | number | null;
    }>((from, to, count) =>
      client
        .from("seo_gsc_page_daily")
        .select("day, page, impressions, clicks, position", { count })
        .gte("day", addDays(asOf, -111))
        .order("day")
        .order("page")
        .range(from, to),
    ),
    client.from("seo_pages").select("id, route_path"),
  ]);
  if (rows.error) fail("Search Console pages", rows.error);
  if (cms.error) fail("page builder pages", cms.error);
  const cmsByPath = new Map((cms.data ?? []).map((p) => [p.route_path, p.id]));
  const byPage = new Map<string, DayRow[]>();
  const firstSeen = new Map<string, string>();
  for (const r of rows.rows) {
    byPage.set(r.page, [
      ...(byPage.get(r.page) ?? []),
      { ...r, position: num(r.position) },
    ]);
    if (!firstSeen.has(r.page)) firstSeen.set(r.page, r.day);
  }
  const toTotals = (s: ReturnType<typeof sum>): Totals => ({
    impressions: s.impressions,
    clicks: s.clicks,
    ctrPct: s.impressions ? (s.clicks / s.impressions) * 100 : null,
    position: s.position,
  });
  const pages = [...byPage].map(([url, list]) => ({
    url,
    path: pathOf(url),
    current: toTotals(sum(list, window(asOf, 0, 28))),
    prior: toTotals(sum(list, window(asOf, 28, 28))),
    weekly: Array.from(
      { length: 16 },
      (_, i) => sum(list, window(asOf, (15 - i) * 7, 7)).impressions,
    ),
    cmsPageId: url.startsWith(SITE)
      ? (cmsByPath.get(pathOf(url)) ?? null)
      : null,
    firstSeen: firstSeen.get(url) ?? asOf,
  }));
  pages.sort((a, b) => b.current.impressions - a.current.impressions);
  return { missing: false, asOf, pages };
}

// -------------------------------------------------------- Keywords and AEO

export type KeywordRow = {
  keyword: string;
  role: string;
  pieceIds: string[];
  hub: string | null;
  volume: number | null;
  kd: number | null;
  gscPosition: number | null;
  gscImpressions: number;
  rank: number | null;
  rankBefore: number | null;
  checked: string | null;
  aiOverview: boolean | null;
  citesSite: boolean;
  citesYouTube: boolean;
};

export type SeoKeywords = {
  missing: false;
  keywords: KeywordRow[];
  lastPull: string | null;
  aeo: {
    checked: number;
    withOverview: number;
    citeSite: number;
    youtubeOnly: number;
    neither: number;
  };
  untracked: Mover[];
};

export async function getSeoKeywords(
  deps: { client?: Client } = {},
): Promise<SeoKeywords | Missing> {
  const client = deps.client ?? createAdminClient();
  const keywords = await client
    .from("seo_keywords")
    .select("keyword, role, piece_ids, hub, volume, kd")
    .eq("tracked", true);
  if (isMissingTable(keywords.error)) return MISSING;
  if (keywords.error) fail("tracked keywords", keywords.error);

  const latestDay = await client
    .from("seo_gsc_query_daily")
    .select("day")
    .order("day", { ascending: false })
    .limit(1);
  if (latestDay.error) fail("Search Console queries", latestDay.error);
  const asOf = latestDay.data?.[0]?.day;
  const [queries, ranks] = await Promise.all([
    asOf
      ? readAllPages<{
          day: string;
          query: string;
          impressions: number;
          clicks: number;
          position: string | number | null;
        }>((from, to, count) =>
          client
            .from("seo_gsc_query_daily")
            .select("day, query, impressions, clicks, position", { count })
            .gte("day", addDays(asOf, -55))
            .order("day")
            .order("query")
            .order("page")
            .range(from, to),
        )
      : Promise.resolve({ rows: [], error: null }),
    client
      .from("seo_rank_snapshots")
      .select(
        "day, keyword, vp_position, ai_overview, aio_cites_site, aio_cites_youtube",
      )
      .gte("day", addDays(new Date().toISOString().slice(0, 10), -60))
      .order("day", { ascending: false }),
  ]);
  if (queries.error) fail("Search Console queries", queries.error);
  if (ranks.error) fail("rank snapshots", ranks.error);

  const byQuery = new Map<string, DayRow[]>();
  for (const r of queries.rows) {
    const k = r.query.toLowerCase();
    byQuery.set(k, [
      ...(byQuery.get(k) ?? []),
      { ...r, position: num(r.position) },
    ]);
  }
  const snaps = new Map<string, Array<(typeof ranks.data & object)[number]>>();
  for (const s of ranks.data ?? [])
    snaps.set(s.keyword, [...(snaps.get(s.keyword) ?? []), s]);
  const lastPull = ranks.data?.[0]?.day ?? null;

  const rows: KeywordRow[] = (keywords.data ?? []).map((k) => {
    const gsc = asOf
      ? sum(byQuery.get(k.keyword) ?? [], window(asOf, 0, 28))
      : null;
    const [latest, ...older] = snaps.get(k.keyword) ?? [];
    const before = older.find(
      (s) => latest && s.day <= addDays(latest.day, -14),
    );
    return {
      keyword: k.keyword,
      role: k.role,
      pieceIds: k.piece_ids,
      hub: k.hub,
      volume: k.volume,
      kd: k.kd,
      gscPosition: gsc?.position ?? null,
      gscImpressions: gsc?.impressions ?? 0,
      rank: latest?.vp_position ?? null,
      rankBefore: before?.vp_position ?? null,
      checked: latest?.day ?? null,
      aiOverview: latest ? latest.ai_overview : null,
      citesSite: Boolean(latest?.aio_cites_site),
      citesYouTube: Boolean(latest?.aio_cites_youtube),
    };
  });
  rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  const checked = rows.filter(
    (r) => r.aiOverview !== null && r.role === "primary",
  );
  const withOverview = checked.filter((r) => r.aiOverview);
  const tracked = new Set(rows.map((r) => r.keyword));
  const untracked = asOf
    ? [...byQuery]
        .filter(([q]) => !tracked.has(q) && !isBrandQuery(q))
        .map(([key, list]) => {
          const cur = sum(list, window(asOf, 0, 28));
          const pri = sum(list, window(asOf, 28, 28));
          return {
            key,
            impressions: cur.impressions,
            priorImpressions: pri.impressions,
            change: cur.impressions - pri.impressions,
            position: cur.position,
          };
        })
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 25)
    : [];
  return {
    missing: false,
    keywords: rows,
    lastPull,
    aeo: {
      checked: checked.length,
      withOverview: withOverview.length,
      citeSite: withOverview.filter((r) => r.citesSite).length,
      youtubeOnly: withOverview.filter((r) => !r.citesSite && r.citesYouTube)
        .length,
      neither: withOverview.filter((r) => !r.citesSite && !r.citesYouTube)
        .length,
    },
    untracked,
  };
}

// ------------------------------------------------------------------ Social

export type SocialNetworkSummary = {
  network: string;
  followers: number | null;
  followersChange: number | null;
  impressions28: number;
  interactions28: number;
  posts28: number;
};

export type SeoSocial = {
  missing: false;
  asOf: string | null;
  networks: SocialNetworkSummary[];
  /** One row a day: Google impressions, social impressions (YouTube views included). */
  visibility: Array<{
    day: string;
    google: number;
    social: number;
    brandSearch: number;
  }>;
};

export const VP_BRAND_ID = "6626386";

export async function getSeoSocial(
  deps: { client?: Client; allBrands?: boolean } = {},
): Promise<SeoSocial | Missing> {
  const client = deps.client ?? createAdminClient();
  const social = await readAllPages<{
    day: string;
    network: string;
    brand_id: string;
    followers: number | null;
    impressions: number | null;
    interactions: number | null;
    posts: number | null;
  }>((from, to, count) => {
    const q = client
      .from("social_account_daily")
      .select(
        "day, network, brand_id, followers, impressions, interactions, posts",
        { count },
      );
    return (deps.allBrands ? q : q.eq("brand_id", VP_BRAND_ID))
      .order("day")
      .order("network")
      .order("brand_id")
      .range(from, to);
  });
  if (isMissingTable(social.error)) return MISSING;
  if (social.error) fail("social account numbers", social.error);
  const google = await client
    .from("seo_gsc_daily")
    .select("day, impressions, brand_impressions")
    .order("day")
    .limit(1000);
  if (google.error && !isMissingTable(google.error))
    fail("Search Console totals", google.error);

  const rows = social.rows;
  const asOf = rows.at(-1)?.day ?? null;
  const networks = [...new Set(rows.map((r) => r.network))]
    .sort()
    .map((network) => {
      const list = rows.filter((r) => r.network === network);
      const followersOn = (day: string) => {
        const same = list.filter((r) => r.day === day && r.followers !== null);
        return same.length
          ? same.reduce((s, r) => s + (r.followers ?? 0), 0)
          : null;
      };
      const lastDay = [...list]
        .reverse()
        .find((r) => r.followers !== null)?.day;
      const now = lastDay ? followersOn(lastDay) : null;
      const then = lastDay ? followersOn(addDays(lastDay, -28)) : null;
      const recent = asOf ? list.filter((r) => r.day > addDays(asOf, -28)) : [];
      return {
        network,
        followers: now,
        followersChange: now !== null && then !== null ? now - then : null,
        impressions28: recent.reduce((s, r) => s + (r.impressions ?? 0), 0),
        interactions28: recent.reduce((s, r) => s + (r.interactions ?? 0), 0),
        posts28: recent.reduce((s, r) => s + (r.posts ?? 0), 0),
      };
    });
  const byDay = new Map<
    string,
    { google: number; social: number; brandSearch: number }
  >();
  for (const g of google.data ?? []) {
    byDay.set(g.day, {
      google: g.impressions,
      social: 0,
      brandSearch: g.brand_impressions,
    });
  }
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { google: 0, social: 0, brandSearch: 0 };
    byDay.set(r.day, { ...d, social: d.social + (r.impressions ?? 0) });
  }
  return {
    missing: false,
    asOf,
    networks,
    visibility: [...byDay]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, v]) => ({ day, ...v })),
  };
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname === "www.vendingpreneurs.com"
      ? u.pathname
      : `${u.hostname}${u.pathname}`;
  } catch {
    // Not an absolute URL: show it as stored.
    return url;
  }
}
