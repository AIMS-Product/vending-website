import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  createDataForSeoClient,
  youtubeIds,
  type DataForSeoClient,
  type SerpSnapshot,
} from "@/lib/dataforseo/client";
import { isMissingTable, TABLE_MISSING } from "@/lib/seo/db";
import { upsertInChunks } from "@/lib/seo/upsert";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, TablesInsert } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

export const RANK_CONNECTOR = "dataforseo-ranks";

/** Live SERP calls in flight at once. DataForSEO allows far more. */
const CONCURRENCY = 6;

export type RankSyncResult = {
  day: string;
  keywords: number;
  volumesRefreshed: boolean;
  connector: SyncRunOutcome;
};

/**
 * Weekly (Mondays): a live SERP for every tracked primary keyword, plus the
 * supporting keywords on even ISO weeks (bi-weekly). On the first Monday of a
 * month it also refreshes volume, CPC and 12 months of history for every
 * tracked keyword, and difficulty. About $0.15 a week at 62 keywords.
 */
export async function syncSeoRanks(
  deps: {
    client?: Client;
    dataforseo?: DataForSeoClient | null;
    now?: Date;
    /** Force every tracked keyword and the volume refresh (first pull). */
    full?: boolean;
  } = {},
): Promise<RankSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const day = now.toISOString().slice(0, 10);
  const dataforseo =
    deps.dataforseo === undefined ? dataForSeoFromConfig() : deps.dataforseo;
  const includeSupporting = deps.full || isoWeek(now) % 2 === 0;
  const refreshVolumes = Boolean(deps.full) || now.getUTCDate() <= 7;
  let keywords = 0;
  let volumesRefreshed = false;

  const connector = await recordSyncRun(client, RANK_CONNECTOR, async () => {
    if (!dataforseo) {
      return skipped(
        "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set (Adam: create the account, see .claude/specs/2026-09-28-seo-command-center.md section 6).",
      );
    }
    const tracked = await client
      .from("seo_keywords")
      .select("keyword, role")
      .eq("tracked", true);
    if (isMissingTable(tracked.error)) return skipped(TABLE_MISSING);
    if (tracked.error) {
      throw new Error(`seo_keywords read failed: ${tracked.error.message}`);
    }
    const all = (tracked.data ?? []).map((row) => row.keyword);
    const toRank = (tracked.data ?? [])
      .filter((row) => includeSupporting || row.role === "primary")
      .map((row) => row.keyword);
    keywords = toRank.length;

    const vpVideoIds = await readVpVideoIds(client);
    const snapshots = await mapLimit(toRank, CONCURRENCY, (keyword) =>
      dataforseo.serp(keyword),
    );
    const rows = snapshots.flatMap((result, index) => {
      if (result instanceof Error) {
        console.error("DataForSEO SERP failed", {
          keyword: toRank[index],
          message: result.message,
        });
        return [];
      }
      return [snapshotRow(day, result, vpVideoIds)];
    });
    const written = await upsertInChunks(
      client,
      "seo_rank_snapshots",
      rows,
      "day,keyword",
    );
    if (written.missing) return skipped(TABLE_MISSING);
    let rowsWritten = written.written;
    const serpFailures = toRank.length - rows.length;

    if (refreshVolumes && all.length > 0) {
      rowsWritten += await refreshKeywordMetrics(client, dataforseo, all, now);
      volumesRefreshed = true;
    }
    const failed = serpFailures + written.failed;
    return {
      rowsWritten,
      error:
        failed > 0
          ? `${failed} of ${toRank.length} keywords failed; see the server log.`
          : null,
    };
  });
  return { day, keywords, volumesRefreshed, connector };
}

export function snapshotRow(
  day: string,
  serp: SerpSnapshot,
  vpVideoIds: ReadonlySet<string>,
): TablesInsert<"seo_rank_snapshots"> {
  return {
    day,
    keyword: serp.keyword,
    vp_position: serp.vpPosition,
    vp_url: serp.vpUrl,
    ai_overview: serp.aiOverview,
    aio_cites_site: serp.aioCitesSite,
    aio_cites_youtube: youtubeIds(serp.aiOverviewRefs).some((id) =>
      vpVideoIds.has(id),
    ),
    aio_refs: serp.aiOverviewRefs.slice(0, 50),
    serp_features: serp.serpFeatures,
    top10: serp.top10,
  };
}

async function refreshKeywordMetrics(
  client: Client,
  dataforseo: DataForSeoClient,
  keywords: string[],
  now: Date,
): Promise<number> {
  const [volumes, difficulty] = await Promise.all([
    dataforseo.searchVolume(keywords),
    dataforseo.keywordDifficulty(keywords),
  ]);
  const kd = new Map(difficulty.map((row) => [row.keyword, row.kd]));
  const updatedAt = now.toISOString();
  let written = 0;
  // Update, never insert: only keywords already on the tracking list.
  for (const row of volumes) {
    const { error } = await client
      .from("seo_keywords")
      .update({
        volume: row.volume,
        cpc: row.cpc,
        competition: row.competition,
        kd: kd.get(row.keyword) ?? null,
        updated_at: updatedAt,
      })
      .eq("keyword", row.keyword);
    if (error) {
      console.error("seo_keywords metric update failed", {
        keyword: row.keyword,
        message: error.message,
      });
    } else written += 1;
  }
  const monthly = await upsertInChunks(
    client,
    "seo_keyword_volume_monthly",
    volumes.flatMap((row) =>
      row.monthly.map((m) => ({
        month: m.month,
        keyword: row.keyword,
        volume: m.volume,
      })),
    ),
    "month,keyword",
  );
  return written + monthly.written;
}

async function readVpVideoIds(client: Client): Promise<Set<string>> {
  const { data, error } = await client
    .from("youtube_videos")
    .select("video_id")
    .limit(5000);
  if (error) {
    // Without the catalog every YouTube citation reads "not VP"; say so.
    console.error("youtube_videos read failed", { message: error.message });
    return new Set();
  }
  return new Set(
    (data ?? []).flatMap((row) => (row.video_id ? [row.video_id] : [])),
  );
}

/** Runs `fn` over items with at most `limit` in flight; errors are returned. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<R | Error>> {
  const out: Array<R | Error> = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        out[index] = await fn(items[index]);
      } catch (error) {
        out[index] = error instanceof Error ? error : new Error(String(error));
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

function dataForSeoFromConfig(): DataForSeoClient | null {
  const login = config.DATAFORSEO_LOGIN;
  const password = config.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return createDataForSeoClient({ login, password });
}
