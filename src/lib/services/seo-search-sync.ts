import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SearchConsoleClient,
  SearchConsoleRow,
} from "@/lib/search-console/client";
import { isBrandQuery } from "@/lib/seo/brand";
import { TABLE_MISSING } from "@/lib/seo/db";
import { upsertInChunks } from "@/lib/seo/upsert";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import type { Database, TablesInsert } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

export const SEO_SEARCH_CONNECTOR = "seo-search-console";

/**
 * Search Console by day, page and query into the seo_gsc_* tables, over the
 * same window as the spine sync. Four requests a run. At this site's volume
 * (about 50 query-page rows a day) a `days=500` run backfills everything the
 * property holds (from 2025-11-26) in one go.
 */
export async function syncSeoSearchDetail(deps: {
  client: SyncClient;
  searchConsole: SearchConsoleClient | null;
  notConfigured: string;
  startDate: string;
  endDate: string;
}): Promise<SyncRunOutcome> {
  const { client, searchConsole, startDate, endDate } = deps;
  return recordSyncRun(client, SEO_SEARCH_CONNECTOR, async () => {
    if (!searchConsole) return skipped(deps.notConfigured);
    const range = { startDate, endDate };
    const [totals, byQuery, pages, queries] = await Promise.all([
      searchConsole.fetchRows({ ...range, dimensions: ["date"] }),
      searchConsole.fetchRows({ ...range, dimensions: ["date", "query"] }),
      searchConsole.fetchRows({ ...range, dimensions: ["date", "page"] }),
      searchConsole.fetchRows({
        ...range,
        dimensions: ["date", "query", "page"],
      }),
    ]);

    const queryRows = queries.map(
      ({
        keys: [day, query, page],
        clicks,
        impressions,
        position,
      }): TablesInsert<"seo_gsc_query_daily"> => ({
        day,
        query,
        page,
        clicks,
        impressions,
        position: round2(position),
      }),
    );
    const writes = [
      await upsertInChunks(
        client,
        "seo_gsc_daily",
        dailyRows(totals, byQuery),
        "day",
      ),
      await upsertInChunks(
        client,
        "seo_gsc_page_daily",
        pages.map(({ keys: [day, page], clicks, impressions, position }) => ({
          day,
          page,
          clicks,
          impressions,
          position: round2(position),
        })),
        "day,page",
      ),
      await upsertInChunks(
        client,
        "seo_gsc_query_daily",
        queryRows,
        "day,query,page",
      ),
    ];
    if (writes.some((w) => w.missing)) return skipped(TABLE_MISSING);
    const failed = writes.reduce((sum, w) => sum + w.failed, 0);
    return {
      rowsWritten: writes.reduce((sum, w) => sum + w.written, 0),
      error:
        failed > 0
          ? `${failed} rows failed to write; see the server log.`
          : null,
    };
  });
}

/**
 * One row a day: Google's totals plus the branded share, summed from the
 * date + query report. Not from the query + page rows: one search that shows
 * two VP pages is one impression per page there, which would double count.
 */
export function dailyRows(
  totals: SearchConsoleRow[],
  byQuery: SearchConsoleRow[],
): TablesInsert<"seo_gsc_daily">[] {
  const brand = new Map<string, { clicks: number; impressions: number }>();
  for (const {
    keys: [day, query],
    clicks,
    impressions,
  } of byQuery) {
    if (!isBrandQuery(query)) continue;
    const sum = brand.get(day) ?? { clicks: 0, impressions: 0 };
    brand.set(day, {
      clicks: sum.clicks + clicks,
      impressions: sum.impressions + impressions,
    });
  }
  return totals.map(({ keys: [day], clicks, impressions, position }) => {
    const b = brand.get(day) ?? { clicks: 0, impressions: 0 };
    return {
      day,
      clicks,
      impressions,
      position: round2(position),
      // Never more than Google's own total for the day.
      brand_clicks: Math.min(b.clicks, clicks),
      brand_impressions: Math.min(b.impressions, impressions),
    };
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
