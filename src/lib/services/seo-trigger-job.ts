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
  const keywords = await client
    .from("seo_keywords")
    .select("keyword, piece_ids")
    .eq("tracked", true);
  const pieces = await client.from("seo_content_pieces").select("id, slug");
  const ranks = await client
    .from("seo_rank_snapshots")
    .select(
      "day, keyword, vp_position, ai_overview, aio_cites_site, aio_cites_youtube, top10",
    )
    .gte("day", addDays(now.toISOString().slice(0, 10), -35));
  for (const read of [pages, queries, keywords, pieces, ranks]) {
    if (read.error)
      throw new Error(`SEO trigger read failed: ${read.error.message}`);
  }

  const slugById = new Map((pieces.data ?? []).map((p) => [p.id, p.slug]));
  const keywordPage = new Map<string, string>();
  for (const row of keywords.data ?? []) {
    const slug = row.piece_ids.map((id) => slugById.get(id)).find(Boolean);
    if (slug) keywordPage.set(row.keyword, `${SITE_ORIGIN}/resources/${slug}`);
  }
  return {
    pageDays: pages.rows.map(numeric),
    queryDays: queries.rows.map(numeric),
    tracked: new Set((keywords.data ?? []).map((row) => row.keyword)),
    ranks: (ranks.data ?? []) as unknown as RankRow[],
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

type OpenTask = {
  id: string;
  trigger_code: number | null;
  url: string | null;
  subject: string | null;
};

const taskKey = (
  code: number | null,
  url: string | null,
  subject: string | null,
) => `${code}\u0000${url ?? ""}\u0000${subject ?? ""}`;

async function writeTasks(client: Client, hits: TriggerHit[], now: Date) {
  const open = await client
    .from("seo_tasks")
    .select("id, trigger_code, url, subject")
    .not("trigger_code", "is", null)
    .in("status", ["open", "in_progress"]);
  if (open.error)
    throw new Error(`seo_tasks read failed: ${open.error.message}`);
  const existing = new Map(
    ((open.data ?? []) as OpenTask[]).map((t) => [
      taskKey(t.trigger_code, t.url, t.subject),
      t.id,
    ]),
  );

  let opened = 0;
  let updated = 0;
  const stamp = now.toISOString();
  for (const hit of hits) {
    const evidence = { ...hit.evidence, seenAt: stamp } as Json;
    const id = existing.get(taskKey(hit.code, hit.url, hit.subject));
    if (id) {
      const { error } = await client
        .from("seo_tasks")
        .update({ evidence, updated_at: stamp })
        .eq("id", id);
      if (error) throw new Error(`seo_tasks update failed: ${error.message}`);
      updated += 1;
      continue;
    }
    const { error } = await client.from("seo_tasks").insert({
      type: hit.type,
      trigger_code: hit.code,
      url: hit.url,
      subject: hit.subject,
      title: hit.title.slice(0, 300),
      detail: PLAYBOOK[hit.code],
      evidence,
      priority: hit.priority,
      due_date: addDays(stamp.slice(0, 10), hit.priority === "urgent" ? 3 : 7),
      created_by: "system",
    });
    if (error) throw new Error(`seo_tasks insert failed: ${error.message}`);
    opened += 1;
  }
  return { opened, updated };
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
    if (!task.metrics_after_14 && asOf >= addDays(doneDay, 14)) {
      patch.metrics_after_14 = pageMetrics(pageDays, absolute(task.url), asOf);
    }
    if (!task.metrics_after_28 && asOf >= addDays(doneDay, 28)) {
      patch.metrics_after_28 = pageMetrics(pageDays, absolute(task.url), asOf);
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
