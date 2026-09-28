import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isBrandQuery } from "@/lib/seo/brand";
import { isMissingTable, TABLE_MISSING } from "@/lib/seo/db";
import {
  addDays,
  evaluateTriggers,
  PLAYBOOK,
  sum,
  window,
  type PageDayRow,
  type QueryDayRow,
  type QueryTotalRow,
  type RankRow,
  type TriggerHit,
} from "@/lib/seo/triggers";
import { readAllPages } from "@/lib/services/paged-read";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

export const TRIGGER_CONNECTOR = "seo-triggers";
export const SITE_ORIGIN = "https://www.vendingpreneurs.com";

export type TriggerJobResult = {
  asOf: string | null;
  hits: number;
  opened: number;
  updated: number;
  logged: number;
  connector: SyncRunOutcome;
};

/**
 * Mondays, after the rank pull: evaluate Kody's 7 triggers and write each hit
 * as a task. A trigger that already has an open task for the same page or
 * keyword updates that task's evidence instead of opening another. Also fills
 * the +14 / +28 day numbers on tasks marked done (the optimization log).
 */
export async function runSeoTriggers(
  deps: { client?: Client; now?: Date } = {},
): Promise<TriggerJobResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? new Date();
  const result: Omit<TriggerJobResult, "connector"> = {
    asOf: null,
    hits: 0,
    opened: 0,
    updated: 0,
    logged: 0,
  };

  const connector = await recordSyncRun(client, TRIGGER_CONNECTOR, async () => {
    const latest = await client
      .from("seo_gsc_page_daily")
      .select("day")
      .order("day", { ascending: false })
      .limit(1);
    if (isMissingTable(latest.error)) return skipped(TABLE_MISSING);
    if (latest.error) throw new Error(latest.error.message);
    const asOf = latest.data?.[0]?.day;
    if (!asOf)
      return skipped("no Search Console page data yet; run the backfill.");
    result.asOf = asOf;

    const inputs = await readInputs(client, asOf, now);
    const hits = evaluateTriggers({ asOf, isBrand: isBrandQuery, ...inputs });
    result.hits = hits.length;
    const written = await writeTasks(client, hits, now);
    result.opened = written.opened;
    result.updated = written.updated;
    result.logged = await fillOptimizationLog(
      client,
      inputs.pageDays,
      asOf,
      now,
    );
    return {
      rowsWritten: written.opened + written.updated + result.logged,
      error: null,
    };
  });
  return { ...result, connector };
}

async function readInputs(client: Client, asOf: string, now: Date) {
  const pages = await readAllPages<PageDayRow>((from, to, count) =>
    client
      .from("seo_gsc_page_daily")
      .select("day, page, clicks, impressions, position", { count })
      .gte("day", addDays(asOf, -90))
      .order("day")
      .order("page")
      .range(from, to),
  );
  const queries = await readAllPages<QueryDayRow>((from, to, count) =>
    client
      .from("seo_gsc_query_daily")
      .select("day, query, page, clicks, impressions, position", { count })
      .gte("day", addDays(asOf, -55))
      .order("day")
      .order("query")
      .order("page")
      .range(from, to),
  );
  const totals = await readAllPages<QueryTotalRow>((from, to, count) =>
    client
      .from("seo_gsc_query_totals_daily")
      .select("day, query, clicks, impressions, position", { count })
      .gte("day", addDays(asOf, -55))
      .order("day")
      .order("query")
      .range(from, to),
  );
  const keywords = await client
    .from("seo_keywords")
    .select("keyword, piece_ids")
    .eq("tracked", true);
  const pieces = await client.from("seo_content_pieces").select("id, slug");
  const ranks = await readAllPages<Omit<RankRow, "top10"> & { top10: Json }>(
    (from, to, count) =>
      client
        .from("seo_rank_snapshots")
        .select(
          "day, keyword, vp_position, ai_overview, aio_cites_site, aio_cites_youtube, top10",
          { count },
        )
        .gte("day", addDays(now.toISOString().slice(0, 10), -35))
        .order("day")
        .order("keyword")
        .range(from, to),
  );
  for (const read of [pages, queries, totals, keywords, pieces, ranks]) {
    if (read.error)
      throw new Error(`SEO trigger read failed: ${read.error.message}`);
  }

  const slugById = new Map((pieces.data ?? []).map((p) => [p.id, p.slug]));
  const keywordPage = new Map<string, string>();
  for (const row of keywords.data ?? []) {
    const slug = row.piece_ids.map((id) => slugById.get(id)).find(Boolean);
    if (slug) {
      keywordPage.set(
        row.keyword.toLowerCase(),
        `${SITE_ORIGIN}/resources/${slug}`,
      );
    }
  }
  return {
    pageDays: pages.rows.map(numeric),
    queryDays: queries.rows.map(numeric),
    queryTotals: totals.rows.map(numeric),
    tracked: new Set(
      (keywords.data ?? []).map((row) => row.keyword.toLowerCase()),
    ),
    ranks: ranks.rows.map(
      (row): RankRow => ({
        ...row,
        keyword: row.keyword.toLowerCase(),
        // Written by snapshotRow from SerpSnapshot.top10; an array or nothing.
        top10: Array.isArray(row.top10)
          ? (row.top10 as unknown as RankRow["top10"])
          : [],
      }),
    ),
    keywordPage,
  };
}

/** PostgREST returns numeric columns as strings. */
function numeric<T extends { position: number | string | null }>(row: T): T {
  return {
    ...row,
    position: row.position === null ? null : Number(row.position),
  };
}

type KnownTask = {
  id: string;
  trigger_code: number | null;
  url: string | null;
  subject: string | null;
  status: string;
  done_at: string | null;
};

/**
 * The dedupe key, matching seo_tasks_open_trigger_idx: a keyword task is one
 * task per keyword whatever page it lands on this week; a page task is one
 * per page.
 */
export const taskKey = (
  code: number | null,
  url: string | null,
  subject: string | null,
) => `${code}\u0000${subject ?? url ?? ""}`;

/** A done task stays quiet this long before the same trigger may reopen. */
const DONE_QUIET_DAYS = 28;

async function writeTasks(client: Client, hits: TriggerHit[], now: Date) {
  const known = await client
    .from("seo_tasks")
    .select("id, trigger_code, url, subject, status, done_at")
    .not("trigger_code", "is", null)
    .limit(5000);
  if (known.error)
    throw new Error(`seo_tasks read failed: ${known.error.message}`);
  const stamp = now.toISOString();
  const quietSince = addDays(stamp.slice(0, 10), -DONE_QUIET_DAYS);
  const open = new Map<string, string>();
  const silenced = new Set<string>();
  for (const t of (known.data ?? []) as KnownTask[]) {
    const key = taskKey(t.trigger_code, t.url, t.subject);
    if (t.status === "open" || t.status === "in_progress") open.set(key, t.id);
    // Dismissed means "not this one": never reopened. Done means "handled":
    // quiet while the +14 / +28 day numbers come in.
    if (t.status === "dismissed") silenced.add(key);
    if (t.status === "done" && (t.done_at ?? "") >= quietSince)
      silenced.add(key);
  }

  let opened = 0;
  let updated = 0;
  let failed = 0;
  for (const hit of hits) {
    const key = taskKey(hit.code, hit.url, hit.subject);
    const evidence = { ...hit.evidence, seenAt: stamp } as Json;
    const id = open.get(key);
    if (!id && silenced.has(key)) continue;
    const { error } = id
      ? await client
          .from("seo_tasks")
          .update({ evidence, updated_at: stamp })
          .eq("id", id)
      : await client.from("seo_tasks").insert({
          type: hit.type,
          trigger_code: hit.code,
          url: hit.url,
          subject: hit.subject,
          title: hit.title.slice(0, 300),
          detail: PLAYBOOK[hit.code],
          evidence,
          priority: hit.priority,
          due_date: addDays(
            stamp.slice(0, 10),
            hit.priority === "urgent" ? 3 : 7,
          ),
          created_by: "system",
        });
    // 23505: another run opened the same task a moment ago. Same outcome.
    if (error && error.code !== "23505") {
      console.error("seo trigger task write failed", {
        code: hit.code,
        message: error.message,
      });
      failed += 1;
      continue;
    }
    if (id || error) updated += 1;
    else opened += 1;
    open.set(key, id ?? "new");
  }
  return { opened, updated, failed };
}

/** Search Console numbers for one page over the 28 days ending asOf. */
export function pageMetrics(
  rows: PageDayRow[],
  url: string,
  asOf: string,
): Record<string, number | string | null> {
  const s = sum(
    rows.filter((row) => row.page === url),
    window(asOf, 0, 28),
  );
  return {
    asOf,
    impressions28: s.impressions,
    clicks28: s.clicks,
    ctrPct: s.impressions
      ? Math.round((s.clicks / s.impressions) * 1000) / 10
      : null,
    position: s.position === null ? null : Math.round(s.position * 10) / 10,
  };
}

async function fillOptimizationLog(
  client: Client,
  pageDays: PageDayRow[],
  asOf: string,
  now: Date,
): Promise<number> {
  const done = await client
    .from("seo_tasks")
    .select("id, url, done_at, metrics_after_14, metrics_after_28")
    .eq("status", "done")
    .not("url", "is", null)
    .gte("done_at", addDays(asOf, -60));
  if (done.error)
    throw new Error(`seo_tasks read failed: ${done.error.message}`);
  let logged = 0;
  for (const task of done.data ?? []) {
    if (!task.url || !task.done_at) continue;
    const doneDay = task.done_at.slice(0, 10);
    const patch: Record<string, Json> = {};
    // Each measured over the 28 days ending exactly done + 14 / done + 28,
    // whenever the job gets to it, so a late run stores the same window.
    for (const [column, days] of [
      ["metrics_after_14", 14],
      ["metrics_after_28", 28],
    ] as const) {
      const end = addDays(doneDay, days);
      if (!task[column] && asOf >= end) {
        patch[column] = pageMetrics(pageDays, absolute(task.url), end);
      }
    }
    if (Object.keys(patch).length === 0) continue;
    const { error } = await client
      .from("seo_tasks")
      .update({ ...patch, updated_at: now.toISOString() })
      .eq("id", task.id);
    if (error) throw new Error(`seo_tasks log update failed: ${error.message}`);
    logged += 1;
  }
  return logged;
}

/** Seeded tasks store paths; Search Console stores absolute URLs. */
export function absolute(url: string): string {
  return url.startsWith("/") ? `${SITE_ORIGIN}${url}` : url;
}
