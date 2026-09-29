import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isVpHost,
  mentionsVp,
  youtubeIds,
  type AiAnswer,
  type DataForSeoClient,
  type LlmMention,
  type YoutubeResult,
} from "@/lib/dataforseo/client";
import { isMissingTable, TABLE_MISSING } from "@/lib/seo/db";
import { upsertInChunks } from "@/lib/seo/upsert";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import {
  dataForSeoFromConfig,
  mapLimit,
  monthlyBudgetUsd,
  monthSpend,
  readVpVideoIds,
  spendTracker,
} from "@/lib/services/seo-rank-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, TablesInsert } from "@/types/database";

/**
 * AI and YouTube visibility, weekly (Mondays, one cron per engine so each
 * fits the route's 300s):
 *   ai_mode  Google AI Mode answer for every tracked primary keyword
 *   chatgpt  the consumer ChatGPT answer for the prompt panel
 *   youtube  YouTube search rank of VP's videos for every primary keyword
 *   mentions DataForSEO's LLM Mentions index for vendingpreneurs.com (monthly)
 * About $2.50 a month together (docs/marketing/dataforseo-v3.md), inside the
 * same $25 cap and spend ledger as the rank job.
 */

type Client = Pick<SupabaseClient<Database>, "from">;
type Row = TablesInsert<"seo_ai_checks">;

export const AI_CONNECTOR = "dataforseo-ai";
export const AI_ENGINES = [
  "ai_mode",
  "chatgpt",
  "youtube",
  "mentions",
] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

/** Buyer-intent prompts no keyword covers: how an LLM ranks VP by name. */
export const BRAND_PROMPTS = [
  "best vending machine business coaching program",
  "is vendingpreneurs legit",
  "vendingpreneurs vs upflip",
  "best vending machine business course",
  "who can teach me to start a vending machine business",
  "vending machine business mentor",
];
/** Primary keywords added to the ChatGPT panel, highest volume first. */
const CHATGPT_KEYWORDS = 20;
const CONCURRENCY = 8;
const BUDGET_MS = 240_000;

export function hostsOf(urls: string[]): string[] {
  const hosts = urls.flatMap((u) => {
    try {
      return [new URL(u).hostname.replace(/^www\./, "")];
    } catch {
      // Not a URL: nothing to count.
      return [];
    }
  });
  return [...new Set(hosts)].slice(0, 25);
}

export function answerRow(
  day: string,
  engine: string,
  answer: AiAnswer,
  vpVideos: ReadonlySet<string>,
): Row {
  const hosts = hostsOf(answer.refs);
  return {
    day,
    engine,
    query: answer.query.toLowerCase(),
    cites_site: hosts.some(isVpHost),
    cites_youtube: youtubeIds(answer.refs).some((id) => vpVideos.has(id)),
    mentions_vp: mentionsVp(answer.text),
    vp_position: null,
    cited_hosts: hosts,
  };
}

export function youtubeRow(
  day: string,
  keyword: string,
  results: YoutubeResult[],
  vpVideos: ReadonlySet<string>,
): Row {
  const vp = results.find((r) => r.videoId && vpVideos.has(r.videoId));
  return {
    day,
    engine: "youtube",
    query: keyword.toLowerCase(),
    cites_site: false,
    cites_youtube: Boolean(vp),
    mentions_vp: results.slice(0, 10).some((r) => mentionsVp(r.title ?? "")),
    vp_position: vp?.rank ?? null,
    cited_hosts: [],
  };
}

export function mentionRow(day: string, m: LlmMention): Row {
  const hosts = hostsOf(m.refs);
  return {
    day,
    engine: `mention:${m.model ?? m.platform}`,
    query: m.question.toLowerCase().slice(0, 500),
    cites_site: hosts.some(isVpHost),
    cites_youtube: false,
    mentions_vp: true,
    vp_position: null,
    cited_hosts: hosts,
  };
}

export async function syncSeoAi(deps: {
  engine: AiEngine;
  client?: Client;
  dataforseo?: DataForSeoClient | null;
  now?: Date;
  clock?: () => number;
}): Promise<{ engine: AiEngine; checked: number; connector: SyncRunOutcome }> {
  const now = deps.now ?? new Date();
  const day = now.toISOString().slice(0, 10);
  const month = `${day.slice(0, 7)}-01`;
  const client = deps.client ?? createAdminClient();
  const spend = spendTracker();
  const dataforseo =
    deps.dataforseo === undefined
      ? dataForSeoFromConfig((endpoint, usd) => spend.add(endpoint, usd))
      : deps.dataforseo;
  const clock = deps.clock ?? Date.now;
  const budgetUsd = monthlyBudgetUsd();
  let checked = 0;

  const connector = await recordSyncRun(client, AI_CONNECTOR, async () => {
    try {
      return await run();
    } finally {
      await spend.flush(client, month);
    }
  });
  return { engine: deps.engine, checked, connector };

  async function run() {
    if (!dataforseo)
      return skipped("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set.");
    const spentBefore = await monthSpend(client, month);
    if (spentBefore >= budgetUsd) {
      return skipped(
        `this month's DataForSEO budget is used ($${spentBefore.toFixed(2)} of $${budgetUsd}).`,
      );
    }
    const probe = await client.from("seo_ai_checks").select("day").limit(1);
    if (isMissingTable(probe.error)) return skipped(TABLE_MISSING);
    if (probe.error)
      throw new Error(`seo_ai_checks read failed: ${probe.error.message}`);

    const vpVideos = await readVpVideoIds(client);
    let rows: Row[] = [];
    let failures = 0;
    const started = clock();
    const within = () =>
      clock() - started <= BUDGET_MS && spentBefore + spend.total() < budgetUsd;

    if (deps.engine === "mentions") {
      rows = (await dataforseo.llmMentions("vendingpreneurs.com", 100)).map(
        (m) => mentionRow(day, m),
      );
    } else {
      const tracked = await client
        .from("seo_keywords")
        .select("keyword, volume")
        .eq("tracked", true)
        .eq("role", "primary");
      if (tracked.error)
        throw new Error(`seo_keywords read failed: ${tracked.error.message}`);
      const primary = [...(tracked.data ?? [])]
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .map((r) => r.keyword);
      const queries =
        deps.engine === "chatgpt"
          ? [...BRAND_PROMPTS, ...primary.slice(0, CHATGPT_KEYWORDS)]
          : primary;
      checked = queries.length;
      const results = await mapLimit(queries, CONCURRENCY, async (q) => {
        if (!within()) throw new Error("out of time or budget");
        if (deps.engine === "youtube") {
          return youtubeRow(
            day,
            q,
            await dataforseo.youtubeSearch(q),
            vpVideos,
          );
        }
        const answer =
          deps.engine === "ai_mode"
            ? await dataforseo.aiMode(q)
            : await dataforseo.chatGpt(q);
        return answerRow(day, deps.engine, answer, vpVideos);
      });
      rows = results.flatMap((r, i) => {
        if (r instanceof Error) {
          console.error("DataForSEO AI check failed", {
            engine: deps.engine,
            query: queries[i],
            message: r.message,
          });
          failures += 1;
          return [];
        }
        return [r];
      });
    }
    const written = await upsertInChunks(
      client,
      "seo_ai_checks",
      rows,
      "day,engine,query",
    );
    if (written.missing) return skipped(TABLE_MISSING);
    const failed = failures + written.failed;
    return {
      rowsWritten: written.written,
      error: failed
        ? `${failed} ${deps.engine} checks failed; see the server log.`
        : null,
    };
  }
}
