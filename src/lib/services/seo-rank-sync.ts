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

/** Live SERP calls in flight at once. DataForSEO allows 2,000 a minute. */
const CONCURRENCY = 10;
/** Stop starting SERP batches after this, inside the route's 300s. */
const BUDGET_MS = 240_000;

export type RankSyncResult = {
  day: string;
  keywords: number;
  volumesRefreshed: boolean;
  connector: SyncRunOutcome;
};

/**
 * Weekly (Mondays), on DataForSEO's standard queue: the 13:00 run collects
 * anything finished and posts this week's keywords; the 13:50 run
 * (collectOnly) collects them before the 14:00 trigger job reads them.
 * Every tracked primary keyword, plus the
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
    clock?: () => number;
    budgetMs?: number;
    /** Monthly USD cap; default DATAFORSEO_MONTHLY_BUDGET_USD or $25. */
    budgetUsd?: number;
    /** Only collect finished tasks; post nothing (the 13:50 Monday run). */
    collectOnly?: boolean;
  } = {},
): Promise<RankSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const day = now.toISOString().slice(0, 10);
  const dataforseo =
    deps.dataforseo === undefined
      ? dataForSeoFromConfig((endpoint, usd) => spend.add(endpoint, usd))
      : deps.dataforseo;
  const clock = deps.clock ?? Date.now;
  const spend = spendTracker();
  const budgetMs = deps.budgetMs ?? BUDGET_MS;
  const includeSupporting = deps.full || isoWeek(now) % 2 === 0;
  const refreshVolumes = Boolean(deps.full) || now.getUTCDate() <= 7;
  let keywords = 0;
  let volumesRefreshed = false;

  const month = `${day.slice(0, 7)}-01`;
  const budgetUsd = deps.budgetUsd ?? monthlyBudgetUsd();
  let spentBefore = 0;

  const connector = await recordSyncRun(client, RANK_CONNECTOR, async () => {
    try {
      return await run();
    } finally {
      await spend.flush(client, month);
    }
  });

  async function run() {
    if (!dataforseo) {
      return skipped(
        "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set (Adam: create the account, see .claude/specs/2026-09-28-seo-command-center.md section 6).",
      );
    }
    spentBefore = await monthSpend(client, month);
    if (spentBefore >= budgetUsd) {
      return skipped(
        `this month's DataForSEO budget is used ($${spentBefore.toFixed(2)} of $${budgetUsd}); raise DATAFORSEO_MONTHLY_BUDGET_USD to pull more.`,
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
    // Primary keywords first, so a run cut short still covers them.
    tracked.data?.sort((a, b) =>
      a.role === b.role ? 0 : a.role === "primary" ? -1 : 1,
    );
    const toRank = (tracked.data ?? [])
      .filter((row) => includeSupporting || row.role === "primary")
      .map((row) => row.keyword);
    keywords = toRank.length;

    const vpVideoIds = await readVpVideoIds(client);
    const started = clock();
    const outOfTime = () =>
      clock() - started > budgetMs || spentBefore + spend.total() >= budgetUsd;
    let rowsWritten = 0;
    let getFailures = 0;
    let writeFailures = 0;

    // 1. Collect every finished standard-queue task (free), each dated by the
    // day it was posted (its tag). Written batch by batch, so a run the
    // platform cuts off keeps what it read; the rest stay ready for next time.
    const ready = await dataforseo.readySerpTasks();
    const batchSize = CONCURRENCY * 4;
    for (
      let i = 0;
      i < ready.length && clock() - started <= budgetMs;
      i += batchSize
    ) {
      const batch = ready.slice(i, i + batchSize);
      const results = await mapLimit(batch, CONCURRENCY, (task) =>
        dataforseo.getSerpTask(task.id),
      );
      const rows = results.flatMap((result, index) => {
        if (result instanceof Error) {
          console.error("DataForSEO task_get failed", {
            id: batch[index].id,
            message: result.message,
          });
          getFailures += 1;
          return [];
        }
        const tag = batch[index].tag;
        return [
          snapshotRow(
            tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : day,
            result,
            vpVideoIds,
          ),
        ];
      });
      const written = await upsertInChunks(
        client,
        "seo_rank_snapshots",
        rows,
        "day,keyword",
      );
      if (written.missing) return skipped(TABLE_MISSING);
      rowsWritten += written.written;
      writeFailures += written.failed;
    }

    // 2. Post this run's keywords to the standard queue (billed now, about
    // $0.0066 each vs $0.022 live; results in ~5 min, collected by the next
    // run). The collect-only run skips this.
    let posted = 0;
    let postFailed = false;
    if (!deps.collectOnly && toRank.length > 0 && !outOfTime()) {
      try {
        posted = await dataforseo.postSerpTasks(toRank, day);
      } catch (error) {
        console.error("DataForSEO task_post failed", {
          message: error instanceof Error ? error.message : undefined,
        });
        postFailed = true;
      }
    }
    keywords = posted;

    const problems: string[] = [];
    if (getFailures + writeFailures > 0) {
      problems.push(
        `${getFailures + writeFailures} of ${ready.length} finished SERPs failed to collect; see the server log.`,
      );
    }
    if (
      postFailed ||
      (!deps.collectOnly && posted < toRank.length && !outOfTime())
    ) {
      problems.push(
        `${toRank.length - posted} of ${toRank.length} keywords were not queued; see the server log.`,
      );
    }
    // The volume refresh is extra: it never costs the snapshots already kept.
    if (!deps.collectOnly && refreshVolumes && all.length > 0 && !outOfTime()) {
      try {
        rowsWritten += await refreshKeywordMetrics(
          client,
          dataforseo,
          all,
          now,
        );
        volumesRefreshed = true;
      } catch (error) {
        console.error("DataForSEO volume refresh failed", {
          message: error instanceof Error ? error.message : undefined,
        });
        problems.push("The monthly volume refresh failed; see the server log.");
      }
      try {
        rowsWritten += await pullCompetitors(client, dataforseo, month);
      } catch (error) {
        console.error("DataForSEO competitor pull failed", {
          message: error instanceof Error ? error.message : undefined,
        });
        problems.push(
          "The monthly competitor pull failed; see the server log.",
        );
      }
    }
    return { rowsWritten, error: problems.length ? problems.join(" ") : null };
  }
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

export async function refreshKeywordMetrics(
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

/**
 * The domains Kody's competitor analysis names, plus VP itself (which
 * cross-checks Search Console and finds VP pages outside /resources).
 */
export const COMPETITOR_DOMAINS = [
  "vendsoft.com",
  "upflip.com",
  "wendor.ai",
  "vendingpreneurs.com",
] as const;

/** Monthly: every keyword each domain ranks for in Google's top 20. */
async function pullCompetitors(
  client: Client,
  dataforseo: DataForSeoClient,
  month: string,
): Promise<number> {
  let written = 0;
  for (const domain of COMPETITOR_DOMAINS) {
    const rows = await dataforseo.rankedKeywords(domain);
    const result = await upsertInChunks(
      client,
      "seo_competitor_keywords",
      rows.map((r) => ({ month, domain, ...r })),
      "month,domain,keyword",
    );
    written += result.written;
  }
  return written;
}

/** Default $25 a month: weekly ranks are roughly $2-12, the rest cents. */
export const DEFAULT_MONTHLY_BUDGET_USD = 25;

export function monthlyBudgetUsd(): number {
  const value = Number(config.DATAFORSEO_MONTHLY_BUDGET_USD);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MONTHLY_BUDGET_USD;
}

async function monthSpend(client: Client, month: string): Promise<number> {
  const { data, error } = await client
    .from("dataforseo_spend")
    .select("usd")
    .eq("month", month);
  if (isMissingTable(error)) return 0;
  if (error) throw new Error(`dataforseo_spend read failed: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.usd), 0);
}

/** Adds up what each call cost and writes it once the run ends. */
function spendTracker() {
  const byEndpoint = new Map<string, { usd: number; calls: number }>();
  return {
    add(endpoint: string, usd: number) {
      const row = byEndpoint.get(endpoint) ?? { usd: 0, calls: 0 };
      byEndpoint.set(endpoint, { usd: row.usd + usd, calls: row.calls + 1 });
    },
    total() {
      return [...byEndpoint.values()].reduce((s, r) => s + r.usd, 0);
    },
    async flush(client: Client, month: string) {
      for (const [endpoint, run] of byEndpoint) {
        const prior = await client
          .from("dataforseo_spend")
          .select("usd, calls")
          .eq("month", month)
          .eq("endpoint", endpoint)
          .maybeSingle();
        if (isMissingTable(prior.error)) return;
        const { error } = await client.from("dataforseo_spend").upsert(
          {
            month,
            endpoint,
            usd: Number(prior.data?.usd ?? 0) + run.usd,
            calls: (prior.data?.calls ?? 0) + run.calls,
          },
          { onConflict: "month,endpoint" },
        );
        if (error) {
          // Spend already happened; losing the record only weakens the cap.
          console.error("dataforseo_spend write failed", {
            endpoint,
            usd: run.usd,
            message: error.message,
          });
        }
      }
      byEndpoint.clear();
    },
  };
}

function dataForSeoFromConfig(
  onCost: (endpoint: string, usd: number) => void,
): DataForSeoClient | null {
  const login = config.DATAFORSEO_LOGIN;
  const password = config.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return createDataForSeoClient({ login, password, onCost });
}
