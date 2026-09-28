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
  status_message: z.string().optional(),
  tasks: z
    .array(
      z.object({
        status_code: z.number(),
        status_message: z.string().optional(),
        result: z.array(z.unknown()).nullable().optional(),
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

const serpResult = z.object({ items: z.array(serpItem).nullable().optional() });

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
};

export function createDataForSeoClient({
  login,
  password,
  fetchImpl = fetch,
}: {
  login: string;
  password: string;
  fetchImpl?: typeof fetch;
}): DataForSeoClient {
  const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;

  const post = async (path: string, body: unknown): Promise<unknown[]> => {
    const response = await fetchImpl(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `DataForSEO ${path} failed with HTTP ${response.status}.`,
      );
    }
    const parsed = envelope.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`DataForSEO ${path} returned an unexpected shape.`);
    }
    const data = parsed.data;
    if (data.status_code !== 20000) {
      throw new Error(
        `DataForSEO ${path}: ${data.status_code} ${data.status_message ?? ""}`.trim(),
      );
    }
    for (const task of data.tasks) {
      if (task.status_code !== 20000) {
        throw new Error(
          `DataForSEO ${path} task: ${task.status_code} ${task.status_message ?? ""}`.trim(),
        );
      }
    }
    return data.tasks.flatMap((task) => task.result ?? []);
  };

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
  };
}

/** Pure: one SERP's items to the row /admin/seo stores. */
export function snapshotFromItems(
  keyword: string,
  items: z.infer<typeof serpItem>[],
): SerpSnapshot {
  const organic = items.filter((item) => item.type === "organic");
  const vp = organic.find((item) => (item.domain ?? "").includes(VP_DOMAIN));
  const aio = items.find((item) => item.type === "ai_overview");
  const refs = aio ? [...new Set(urlsIn(aio))].sort() : [];
  return {
    keyword,
    vpPosition: vp?.rank_group ?? null,
    vpUrl: vp?.url ?? null,
    aiOverview: Boolean(aio),
    aiOverviewRefs: refs,
    aioCitesSite: refs.some((url) => hostOf(url).endsWith(VP_DOMAIN)),
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
