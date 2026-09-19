import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkLinkStandard,
  parseLinkUtms,
} from "@/lib/analytics/link-standard";
import { config } from "@/lib/config";
import {
  createMetricoolClient,
  readMetric,
  type AdNetwork,
  type MetricoolCampaign,
  type MetricoolClient,
  type MetricoolPost,
} from "@/lib/metricool/client";
import {
  channelDailyKey,
  recordSyncRun,
  upsertChannelDaily,
  type ChannelDailyRow,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, TablesInsert } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

export const METRICOOL_CONNECTOR = "metricool-posts";
export const METRICOOL_ADS_CONNECTOR = "metricool-ads";

/**
 * Ad platforms restate the last day or two as late conversions and spend
 * settle, so every run rewrites a short trailing window. `days` widens it.
 */
const ADS_WINDOW_DAYS = 3;
const AD_NETWORKS: readonly AdNetwork[] = ["googleads", "facebookads"];

/**
 * Post metrics are lifetime totals that keep growing after publication, so the
 * run re-reads a month of posts and upserts them in place. `days` widens it.
 */
const WINDOW_DAYS = 30;

/** Metricool network names → link-standard sources. Others pass through. */
const NETWORK_SOURCE: Record<string, string> = { twitter: "x" };

/**
 * Person brands keep their owner: a post from Mike's Metricool brand lands as
 * `mike-ig`, which `resolveChannel` reads as Instagram + Mike, the same shape
 * as the team's tagged links. The Vendingpreneurs brand writes plain network
 * sources. Blog ids from `GET /v2/settings/brands`, 2026-09-11.
 */
const BRAND_OWNER: Record<string, string> = {
  "6633336": "mike",
  "6633345": "anthony",
};

/** Network → the suffix `SUFFIX_CHANNEL` in channel.ts understands. */
const NETWORK_SUFFIX: Record<string, string> = {
  instagram: "ig",
  facebook: "fb",
  linkedin: "li",
  tiktok: "tt",
  twitter: "x",
  youtube: "yt",
};

/**
 * Metric names Metricool has used for the three numbers the spine stores,
 * across the brand summary (uppercase) and the typed per-network endpoints.
 * Link clicks come before post clicks: the spine counts clicks to our site.
 */
const METRIC_NAMES = {
  reach: [
    "reach",
    "reachTotal",
    "impressionsUnique",
    "uniqueImpressions",
    "postImpressionsUnique",
  ],
  impressions: [
    "impressions",
    "impressionsTotal",
    "totalImpressions",
    "views",
    "viewCount",
    "videoViewsTotal",
    "blueReelsPlayCount",
  ],
  clicks: [
    "linkclicks",
    "linkClicks",
    "totalLinkClicks",
    "organicLinkClicks",
    "clicks",
    "postClicks",
    "postClicksPaid",
  ],
};

export type MetricoolSyncResult = {
  endDate: string;
  connector: SyncRunOutcome;
  ads: SyncRunOutcome;
};

export async function syncMetricool(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    metricool?: MetricoolClient | null;
    /** Brands to pull, in order; the first brand to report a post owns it. */
    blogIds?: string[];
    now?: Date;
    days?: number;
  } = {},
): Promise<MetricoolSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const metricool =
    deps.metricool === undefined ? metricoolFromConfig() : deps.metricool;
  const blogIds = deps.blogIds ?? blogIdsFromConfig();
  const endDate = dayKey(now);
  const startDate = dayKey(addDays(now, -(deps.days ?? WINDOW_DAYS)));

  const connector = await recordSyncRun(
    client,
    METRICOOL_CONNECTOR,
    async () => {
      if (!metricool || blogIds.length === 0) {
        return skipped(
          "METRICOOL_API_KEY / METRICOOL_USER_ID / METRICOOL_BLOG_IDS are not configured.",
        );
      }
      // The Vendingpreneurs and Mike brands share one Facebook page, so the
      // same post comes back under both blog ids. First brand listed wins.
      const seen = new Set<string>();
      const rows: MetricoolPostRow[] = [];
      for (const blogId of blogIds) {
        const posts = await metricool.fetchPosts({
          blogId,
          from: startDate,
          to: endDate,
        });
        for (const post of posts) {
          if (seen.has(post.id)) continue;
          seen.add(post.id);
          rows.push(postRow(post, now, blogId));
        }
      }
      if (rows.length === 0) return { rowsWritten: 0 };

      const { error } = await client
        .from("metricool_posts")
        .upsert(rows, { onConflict: "post_id" });
      if (error)
        throw new Error(`metricool_posts upsert failed: ${error.message}`);

      // YouTube's Seen is written per video per day by youtube-analytics.
      // A post row here would stamp the video's lifetime views on its publish
      // day and count them again.
      const result = await upsertChannelDaily(
        client,
        rows.filter((row) => row.network !== "youtube").map(channelRow),
        { now },
      );
      const nonCompliant = rows.filter(
        (row) => row.link_compliant === false,
      ).length;
      return {
        rowsWritten: rows.length + result.written,
        error:
          result.failed > 0
            ? `${result.failed} channel_daily rows failed to write; see the server log.`
            : nonCompliant > 0
              ? `${nonCompliant} posts link somewhere without the standard UTMs.`
              : null,
      };
    },
  );
  const ads = await recordSyncRun(client, METRICOOL_ADS_CONNECTOR, async () => {
    if (!metricool || blogIds.length === 0) {
      return skipped(
        "METRICOOL_API_KEY / METRICOOL_USER_ID / METRICOOL_BLOG_IDS are not configured.",
      );
    }
    // Only the first brand: the person brands connect the same ad accounts,
    // so reading them too would count every dollar twice.
    const adsBlogId = blogIds[0]!;
    const rows: ChannelDailyRow[] = [];
    const adsStart = dayKey(addDays(now, -(deps.days ?? ADS_WINDOW_DAYS)));
    for (
      let day = adsStart;
      day <= endDate;
      day = dayKey(addDays(new Date(`${day}T00:00:00.000Z`), 1))
    ) {
      for (const network of AD_NETWORKS) {
        const campaigns = await metricool.fetchCampaigns({
          blogId: adsBlogId,
          network,
          from: day,
          to: day,
        });
        for (const campaign of campaigns)
          rows.push(adRow(network, campaign, day));
      }
    }
    if (rows.length === 0) return { rowsWritten: 0 };
    const written = await upsertChannelDaily(client, rows, { now });
    // Only after every write landed: clearing a renamed row whose replacement
    // failed to write would lose that day's spend instead of double counting it.
    const cleared =
      written.failed === 0
        ? await clearRenamedAdRows(client, rows, { now })
        : { written: 0, failed: 0 };
    const failed = written.failed + cleared.failed;
    return {
      rowsWritten: written.written + cleared.written,
      error:
        failed > 0
          ? `${failed} channel_daily rows failed to write; see the server log.`
          : null,
    };
  });
  return { endDate, connector, ads };
}

const AD_METRICS_BLANK = {
  spend: null,
  impressions: null,
  reach: null,
  clicks: null,
} as const;

/**
 * Blanks the ad metrics on a campaign day stored under an older name.
 *
 * The campaign name rides in `content`, which is part of the spine key, and
 * the webinar campaign is renamed every week. A rename inside the rewrite
 * window writes the same campaign day under a second key while the old-name
 * row keeps its spend, so the day counts twice (Sep 15 2026: $462 + $698.43
 * against Meta's $866.03). Only rows for a (day, source, campaign) this run
 * wrote are touched, so a quiet API day never blanks real spend.
 */
async function clearRenamedAdRows(
  client: SyncClient,
  rows: readonly ChannelDailyRow[],
  { now }: { now: Date },
) {
  const liveContent = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = channelDailyKey(row);
    const id = adDayId(key);
    liveContent.set(id, (liveContent.get(id) ?? new Set()).add(key.content));
  }
  const days = rows.map((row) => row.day).sort();
  // Paged: PostgREST silently caps a read at 1,000 rows, and a `days=400`
  // backfill stores more ad rows than that.
  const stored: StoredAdRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("channel_daily")
      .select("day,source,medium,campaign,content,destination")
      .in("source", ["google", "meta_ads"])
      .gte("day", days[0]!)
      .lte("day", days.at(-1)!)
      .not("spend", "is", null)
      .order("day")
      .order("campaign")
      .order("content")
      .range(from, from + 999);
    if (error) throw new Error(`channel_daily read failed: ${error.message}`);
    stored.push(...((data ?? []) as StoredAdRow[]));
    if ((data ?? []).length < 1000) break;
  }

  const renamed = stored.filter((row) => {
    const live = liveContent.get(adDayId(row));
    return live !== undefined && !live.has(row.content);
  });
  if (renamed.length === 0) return { written: 0, failed: 0 };
  return upsertChannelDaily(
    client,
    renamed.map((row) => ({
      day: row.day,
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      content: row.content,
      // `destination` is what the term resolved to; it round-trips unchanged.
      term: row.destination,
      ...AD_METRICS_BLANK,
    })),
    { now },
  );
}

type StoredAdRow = {
  day: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination: string;
};

function adDayId(row: { day: string; source: string; campaign: string }) {
  return `${row.day}\u0000${row.source}\u0000${row.campaign}`;
}

/**
 * One campaign's day on the spine. Keyed by the platform's campaign id, which
 * is what a Google Ads link carries as utm_campaign, so spend lands on the
 * same row as the leads it bought; the human name rides in `content` because
 * the webinar campaign is renamed every week. A Meta campaign named for the
 * webinar belongs to the Webinar program, not to Meta Ads.
 */
export function adRow(
  network: AdNetwork,
  campaign: MetricoolCampaign,
  day: string,
): ChannelDailyRow {
  const google = network === "googleads";
  return {
    day,
    channel: !google && /webinar/i.test(campaign.name) ? "Webinar" : null,
    source: google ? "google" : "meta_ads",
    medium: google ? "cpc" : "paid",
    campaign: campaign.id,
    content: campaign.name,
    term: null,
    spend: campaign.spend,
    impressions: campaign.impressions,
    reach: campaign.reach,
    clicks: campaign.clicks,
  };
}

export type MetricoolPostRow = TablesInsert<"metricool_posts">;

/** One stored row per post: link found, UTMs parsed, standard checked. */
export function postRow(
  post: MetricoolPost,
  now: Date,
  brandId: string | null = null,
): MetricoolPostRow {
  const link = firstOutboundUrl(post.text, post.permalink);
  const utms = link ? parseLinkUtms(link) : null;
  const check = link ? checkLinkStandard(link) : null;
  return {
    post_id: post.id,
    brand_id: brandId,
    network: post.network,
    published_at: post.publishedAt,
    permalink: post.permalink,
    link,
    text_excerpt: post.text.slice(0, 280) || null,
    reach: readMetric(post.metrics, METRIC_NAMES.reach),
    impressions: readMetric(post.metrics, METRIC_NAMES.impressions),
    clicks: readMetric(post.metrics, METRIC_NAMES.clicks),
    utm_source: utms?.source ?? null,
    utm_medium: utms?.medium ?? null,
    utm_campaign: utms?.campaign ?? null,
    utm_content: utms?.content ?? null,
    utm_term: utms?.term ?? null,
    link_compliant: check ? check.compliant : null,
    link_problems: check?.problems ?? [],
    metrics: post.metrics as MetricoolPostRow["metrics"],
    synced_at: now.toISOString(),
  };
}

/**
 * The spine row for a post, credited to its publication day. A post with no
 * standard UTMs still lands: source from the network (owner-prefixed for a
 * person brand), medium organic, content = the post id, campaign and
 * destination "(not set)" / unknown.
 */
export function channelRow(row: MetricoolPostRow): ChannelDailyRow {
  return {
    day: String(row.published_at).slice(0, 10),
    source: row.utm_source ?? networkSource(row.network, row.brand_id ?? null),
    medium: row.utm_medium ?? "organic",
    campaign: row.utm_campaign ?? null,
    content: row.utm_content ?? row.post_id,
    term: row.utm_term ?? null,
    reach: row.reach ?? null,
    impressions: row.impressions ?? null,
    clicks: row.clicks ?? null,
  };
}

export function networkSource(network: string, brandId: string | null): string {
  const owner = brandId ? BRAND_OWNER[brandId] : undefined;
  const suffix = NETWORK_SUFFIX[network];
  if (owner && suffix) return `${owner}-${suffix}`;
  return NETWORK_SOURCE[network] ?? network;
}

const URL_PATTERN = /https?:\/\/[^\s<>()"']+/g;

/** The first URL in the post text that is not the post itself. */
export function firstOutboundUrl(
  text: string,
  permalink: string | null,
): string | null {
  const permalinkHost = hostOf(permalink);
  for (const match of text.match(URL_PATTERN) ?? []) {
    const candidate = match.replace(/[.,;:!?]+$/, "");
    const host = hostOf(candidate);
    if (!host) continue;
    if (permalinkHost && host === permalinkHost) continue;
    return candidate;
  }
  return null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function metricoolFromConfig(): MetricoolClient | null {
  const { METRICOOL_API_KEY, METRICOOL_USER_ID } = config;
  if (!METRICOOL_API_KEY || !METRICOOL_USER_ID) return null;
  return createMetricoolClient({
    apiKey: METRICOOL_API_KEY,
    userId: METRICOOL_USER_ID,
  });
}

/** `METRICOOL_BLOG_IDS` comma list, else the single `METRICOOL_BLOG_ID`. */
export function blogIdsFromConfig(): string[] {
  const list = (config.METRICOOL_BLOG_IDS ?? config.METRICOOL_BLOG_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
