import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  createMetricoolTimelines,
  NETWORK_SERIES,
  type MetricoolTimelines,
  type SocialNetwork,
} from "@/lib/metricool/timelines";
import { TABLE_MISSING } from "@/lib/seo/db";
import { upsertInChunks } from "@/lib/seo/upsert";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import type { TablesInsert } from "@/types/database";

type Client = Pick<SupabaseClient, "from">;
type Row = TablesInsert<"social_account_daily">;

export const SOCIAL_ACCOUNTS_CONNECTOR = "metricool-accounts";

/**
 * Followers, impressions, reach, interactions and posts per network per brand
 * per day into `social_account_daily`, for the /admin/seo Social tab. Runs
 * with the nightly Metricool sync over the same window (`days` backfills).
 *
 * The Vendingpreneurs and Mike brands share one Facebook page, so Facebook
 * is kept only for the first brand in METRICOOL_BLOG_IDS that returns it,
 * the same ownership rule metricool-sync.ts applies to posts.
 */
export async function syncSocialAccounts(deps: {
  client: Client;
  blogIds: string[];
  timelines?: MetricoolTimelines | null;
  from: string;
  to: string;
}): Promise<SyncRunOutcome> {
  const timelines =
    deps.timelines === undefined ? timelinesFromConfig() : deps.timelines;
  return recordSyncRun(deps.client, SOCIAL_ACCOUNTS_CONNECTOR, async () => {
    if (!timelines || deps.blogIds.length === 0) {
      return skipped(
        "METRICOOL_API_KEY / METRICOOL_USER_ID / METRICOOL_BLOG_IDS are not configured.",
      );
    }
    const rows = new Map<string, Row>();
    let facebookOwner: string | null = null;
    let failures = 0;
    for (const blogId of deps.blogIds) {
      for (const network of Object.keys(NETWORK_SERIES) as SocialNetwork[]) {
        if (network === "facebook" && facebookOwner) continue;
        let connected = false;
        for (const series of NETWORK_SERIES[network]) {
          let points;
          try {
            points = await timelines.fetch({
              blogId,
              network,
              metric: series.metric,
              subject: series.subject,
              from: deps.from,
              to: deps.to,
            });
          } catch (error) {
            failures += 1;
            console.warn("metricool timeline failed", {
              blogId,
              network,
              metric: series.metric,
              message: error instanceof Error ? error.message : undefined,
            });
            continue;
          }
          if (points === null) break; // not connected for this brand
          connected = true;
          for (const { day, value } of points) {
            const key = `${day}|${network}|${blogId}`;
            const row = rows.get(key) ?? { day, network, brand_id: blogId };
            rows.set(key, { ...row, [series.column]: value });
          }
        }
        if (network === "facebook" && connected) facebookOwner = blogId;
      }
    }
    const written = await upsertInChunks(
      deps.client,
      "social_account_daily",
      [...rows.values()],
      "day,network,brand_id",
    );
    if (written.missing) return skipped(TABLE_MISSING);
    if (written.written === 0 && failures > 0) {
      throw new Error(`All ${failures} Metricool timeline requests failed.`);
    }
    return {
      rowsWritten: written.written,
      error:
        written.failed > 0
          ? `${written.failed} rows failed to write; see the server log.`
          : null,
    };
  });
}

function timelinesFromConfig(): MetricoolTimelines | null {
  const { METRICOOL_API_KEY, METRICOOL_USER_ID } = config;
  if (!METRICOOL_API_KEY || !METRICOOL_USER_ID) return null;
  return createMetricoolTimelines({
    apiKey: METRICOOL_API_KEY,
    userId: METRICOOL_USER_ID,
  });
}
