import "server-only";

import { z } from "zod";

/**
 * DataForSEO v3, the three calls /admin/seo needs. Ported from the strategy
 * run's scripts/dataforseo_pull.py. US English only (location 2840).
 *
 * Every response is checked twice: the envelope's status_code and each
 * task's must both be 20000, or the call throws. Credentials never appear in
 * an error message.
 */

const API = "https://api.dataforseo.com/v3";
const LOCATION = { location_code: 2840, language_code: "en" } as const;
export const VP_DOMAIN = "vendingpreneurs.com";
const MAX_KEYWORDS = 1000;

const envelope = z.object({
  status_code: z.number(),
  cost: z.number().optional(),
  status_message: z.string().optional(),
  tasks: z
    .array(
      z.object({
        status_code: z.number(),
        status_message: z.string().optional(),
        result: z.array(z.unknown()).nullable().optional(),
        id: z.string().optional(),
      }),
    )
    .default([]),
});

const serpItem = z
  .object({
    type: z.string(),
    rank_group: z.number().nullable().optional(),
    rank_absolute: z.number().nullable().optional(),
    domain: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    timestamp: z.string().nullable().optional(),
  })
  .passthrough();

const serpResult = z.object({
  keyword: z.string().optional(),
  items: z.array(serpItem).nullable().optional(),
});
const readyTask = z.object({
  id: z.string(),
  tag: z.string().nullable().optional(),
});

const volumeResult = z.object({
  keyword: z.string(),
  search_volume: z.number().nullable().optional(),
  cpc: z.number().nullable().optional(),
  competition: z.union([z.number(), z.string()]).nullable().optional(),
  competition_index: z.number().nullable().optional(),
  monthly_searches: z
    .array(
      z.object({
        year: z.number(),
        month: z.number(),
        search_volume: z.number().nullable(),
      }),
    )
    .nullable()
    .optional(),
});

const kdResult = z.object({
  items: z
    .array(
      z.object({
        keyword: z.string(),
        keyword_difficulty: z.number().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

export type SerpSnapshot = {
  keyword: string;
  vpPosition: number | null;
  vpUrl: string | null;
  aiOverview: boolean;
  /** Every URL referenced anywhere inside the AI Overview item. */
  aiOverviewRefs: string[];
  aioCitesSite: boolean;
  serpFeatures: string[];
  top10: Array<{
    rank: number;
    domain: string;
    url: string;
    title: string | null;
    /** The date Google shows for the result, when it shows one. */
    date: string | null;
  }>;
};

export type KeywordVolume = {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  /** 0-1, Google Ads competition index / 100. */
  competition: number | null;
  monthly: Array<{ month: string; volume: number }>;
};

export type DataForSeoClient = {
  serp(keyword: string): Promise<SerpSnapshot>;
  searchVolume(keywords: string[]): Promise<KeywordVolume[]>;
  keywordDifficulty(
    keywords: string[],
  ): Promise<Array<{ keyword: string; kd: number | null }>>;
  /** Keywords a domain ranks for in Google's top 20 (DataForSEO Labs). */
  rankedKeywords(target: string, limit?: number): Promise<RankedKeyword[]>;
  /** Standard queue: post SERP tasks (billed now), tagged with the snapshot day. */
  postSerpTasks(keywords: string[], tag: string): Promise<number>;
  /** Standard queue: finished tasks not collected yet (free). */
  readySerpTasks(): Promise<Array<{ id: string; tag: string | null }>>;
  /** Standard queue: one finished task's SERP (free for 30 days). */
  getSerpTask(id: string): Promise<SerpSnapshot>;
};

export type RankedKeyword = {
  keyword: string;
  position: number | null;
  volume: number | null;
  url: string | null;
};

const rankedItem = z
  .object({
    keyword_data: z.object({
      keyword: z.string(),
      keyword_info: z
        .object({ search_volume: z.number().nullable().optional() })
        .nullable()
        .optional(),
    }),
    ranked_serp_element: z
      .object({
        serp_item: z
          .object({
            rank_group: z.number().nullable().optional(),
            url: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** DataForSEO codes worth one retry: search engine error (40101), task
 * failed, resubmit (40103), rate limits (40202, 40209), internal / upstream
 * errors (5xxxx). docs/marketing/dataforseo-v3.md section 2. */
const RETRY_CODES = new Set([40101, 40103, 40202, 40209]);
/** Partial results: DataForSEO bills only the pages it returned. Keep them. */
const OK_CODES = new Set([20000, 20100, 40106]);

/** HTTP 403/429/5xx, or a retryable envelope/task code, is worth one retry. */
export function isTransient(httpStatus: number, codes: number[] = []): boolean {
  if (httpStatus === 403 || httpStatus === 429 || httpStatus >= 500) {
    return true;
  }
  return codes.some((c) => RETRY_CODES.has(c) || c >= 50000);
}

export function createDataForSeoClient({
  login,
  password,
  fetchImpl = fetch,
  onCost,
  retryDelayMs = 2_000,
}: {
  login: string;
  password: string;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
  /** Called with the USD DataForSEO says each call cost (budget tracking). */
  onCost?: (endpoint: string, usd: number) => void;
}): DataForSeoClient {
  const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;

  /** POST with a body; GET without one (tasks_ready, task_get). */
  const call = async (path: string, body?: unknown) => {
    const response = await fetchImpl(`${API}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // One slow SERP must not hold a worker past the run's time budget.
      signal: AbortSignal.timeout(90_000),
    });
    const text = await response.text();
    if (!response.ok) return { status: response.status, data: null };
    const parsed = envelope.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`DataForSEO ${path} returned an unexpected shape.`);
    }
    return { status: response.status, data: parsed.data };
  };

  const request = async (path: string, body?: unknown) => {
    let res = await call(path, body);
    // One retry for transient failures: a fresh account answered 403 / 40101
    // on its first call and succeeded on the next; 429 and 5xx are throttling.
    const codes = (r: typeof res) =>
      r.data
        ? [r.data.status_code, ...r.data.tasks.map((t) => t.status_code)]
        : [];
    if (isTransient(res.status, codes(res))) {
      // The first answer may have billed: book it before asking again.
      if (res.data) onCost?.(path, res.data.cost ?? 0);
      await sleep(retryDelayMs);
      res = await call(path, body);
    }
    const data = res.data;
    if (!data) {
      throw new Error(`DataForSEO ${path} failed with HTTP ${res.status}.`);
    }
    // Record the spend before any status check: a failed task can still bill.
    onCost?.(path, data.cost ?? 0);
    if (data.status_code !== 20000) {
      throw new Error(
        `DataForSEO ${path}: ${data.status_code} ${data.status_message ?? ""}`.trim(),
      );
    }
    for (const task of data.tasks) {
      if (!OK_CODES.has(task.status_code)) {
        throw new Error(
          `DataForSEO ${path} task: ${task.status_code} ${task.status_message ?? ""}`.trim(),
        );
      }
    }
    return data.tasks;
  };
  const post = async (path: string, body?: unknown): Promise<unknown[]> =>
    (await request(path, body)).flatMap((task) => task.result ?? []);

  const inBatches = async <T>(
    keywords: string[],
    run: (batch: string[]) => Promise<T[]>,
  ): Promise<T[]> => {
    const out: T[] = [];
    for (let i = 0; i < keywords.length; i += MAX_KEYWORDS) {
      out.push(...(await run(keywords.slice(i, i + MAX_KEYWORDS))));
    }
    return out;
  };

  return {
    async serp(keyword) {
      const [first] = await post("/serp/google/organic/live/advanced", [
        {
          keyword,
          ...LOCATION,
          depth: 100,
          // +$0.002 a request, refunded when no AI Overview appears.
          load_async_ai_overview: true,
        },
      ]);
      const result = serpResult.safeParse(first ?? {});
      if (!result.success) {
        throw new Error("DataForSEO SERP result had an unexpected shape.");
      }
      return snapshotFromItems(keyword, result.data.items ?? []);
    },

    async postSerpTasks(keywords, tag) {
      let created = 0;
      for (let i = 0; i < keywords.length; i += 100) {
        const tasks = await request(
          "/serp/google/organic/task_post",
          keywords.slice(i, i + 100).map((keyword) => ({
            keyword,
            ...LOCATION,
            depth: 100,
            load_async_ai_overview: true,
            tag,
          })),
        );
        created += tasks.filter((t) => t.status_code === 20100).length;
      }
      return created;
    },

    async readySerpTasks() {
      const results = await post("/serp/google/organic/tasks_ready");
      return results.flatMap((raw) => {
        const row = readyTask.safeParse(raw);
        return row.success
          ? [{ id: row.data.id, tag: row.data.tag ?? null }]
          : [];
      });
    },

    async getSerpTask(id) {
      const [first] = await post(
        `/serp/google/organic/task_get/advanced/${encodeURIComponent(id)}`,
      );
      const result = serpResult.safeParse(first ?? {});
      if (!result.success || !result.data.keyword) {
        throw new Error("DataForSEO SERP task result had an unexpected shape.");
      }
      return snapshotFromItems(result.data.keyword, result.data.items ?? []);
    },

    searchVolume(keywords) {
      return inBatches(keywords, async (batch) => {
        const results = await post(
          "/keywords_data/google_ads/search_volume/live",
          [{ keywords: batch, ...LOCATION }],
        );
        return results.flatMap((raw) => {
          const row = volumeResult.safeParse(raw);
          if (!row.success) return [];
          const r = row.data;
          return [
            {
              keyword: r.keyword,
              volume: r.search_volume ?? null,
              cpc: r.cpc ?? null,
              competition:
                r.competition_index == null ? null : r.competition_index / 100,
              monthly: (r.monthly_searches ?? []).flatMap((m) =>
                m.search_volume == null
                  ? []
                  : [
                      {
                        month: `${m.year}-${String(m.month).padStart(2, "0")}-01`,
                        volume: m.search_volume,
                      },
                    ],
              ),
            },
          ];
        });
      });
    },

    keywordDifficulty(keywords) {
      return inBatches(keywords, async (batch) => {
        const results = await post(
          "/dataforseo_labs/google/bulk_keyword_difficulty/live",
          [{ keywords: batch, ...LOCATION }],
        );
        return results.flatMap((raw) => {
          const parsed = kdResult.safeParse(raw);
          return parsed.success
            ? (parsed.data.items ?? []).map((item) => ({
                keyword: item.keyword,
                kd: item.keyword_difficulty ?? null,
              }))
            : [];
        });
      });
    },

    async rankedKeywords(target, limit = 1000) {
      const [first] = await post(
        "/dataforseo_labs/google/ranked_keywords/live",
        [
          {
            target,
            ...LOCATION,
            limit,
            filters: [["ranked_serp_element.serp_item.rank_group", "<=", 20]],
          },
        ],
      );
      const items = (first as { items?: unknown[] } | undefined)?.items ?? [];
      return items.flatMap((raw) => {
        const row = rankedItem.safeParse(raw);
        if (!row.success) return [];
        const item = row.data.ranked_serp_element?.serp_item;
        return [
          {
            keyword: row.data.keyword_data.keyword.toLowerCase(),
            position: item?.rank_group ?? null,
            volume: row.data.keyword_data.keyword_info?.search_volume ?? null,
            url: item?.url ?? null,
          },
        ];
      });
    },
  };
}

/** Pure: one SERP's items to the row /admin/seo stores. */
export function snapshotFromItems(
  keyword: string,
  items: z.infer<typeof serpItem>[],
): SerpSnapshot {
  const organic = items.filter((item) => item.type === "organic");
  const vp = organic.find((item) => isVpHost(item.domain ?? ""));
  const aio = items.find((item) => item.type === "ai_overview");
  const refs = aio ? [...new Set(urlsIn(aio))].sort() : [];
  return {
    keyword,
    vpPosition: vp?.rank_group ?? null,
    vpUrl: vp?.url ?? null,
    aiOverview: Boolean(aio),
    aiOverviewRefs: refs,
    aioCitesSite: refs.some((url) => isVpHost(hostOf(url))),
    serpFeatures: [
      ...new Set(items.map((i) => i.type).filter((t) => t !== "organic")),
    ].sort(),
    top10: organic.slice(0, 10).map((item, index) => ({
      rank: item.rank_group ?? index + 1,
      domain: item.domain ?? "",
      url: item.url ?? "",
      title: item.title ?? null,
      date: item.timestamp ?? null,
    })),
  };
}

/** AI Overview references are nested under sub-items; collect every url. */
export function urlsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) =>
      key === "url" && typeof inner === "string" ? [inner] : urlsIn(inner),
    );
  }
  return [];
}

/** vendingpreneurs.com or a subdomain of it; never a look-alike. */
export function isVpHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === VP_DOMAIN || h.endsWith(`.${VP_DOMAIN}`);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // Not a URL: it cannot be the VP site.
    return "";
  }
}

/** YouTube video ids in a list of URLs (watch?v=, youtu.be/, shorts/). */
export function youtubeIds(urls: string[]): string[] {
  return urls.flatMap((url) => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
    );
    return match ? [match[1]] : [];
  });
}
