import "server-only";

import { z } from "zod";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

/**
 * Metricool's per-day account series (`/v2/analytics/timelines`). The metric
 * names and subjects below are the ones the live API accepted on 2026-09-28;
 * the published OpenAPI list is wrong for several networks, and a wrong name
 * answers 400 with the valid list. A network the brand has not connected
 * answers 403, which is "no data", not an error.
 */

const BASE = "https://app.metricool.com/api/v2/analytics/timelines";

export type SocialColumn =
  | "followers"
  | "impressions"
  | "reach"
  | "interactions"
  | "posts";

export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "youtube";

type Series = { column: SocialColumn; metric: string; subject?: string };

export const NETWORK_SERIES: Record<SocialNetwork, readonly Series[]> = {
  instagram: [
    { column: "followers", metric: "followers", subject: "account" },
    { column: "impressions", metric: "impressions", subject: "posts" },
    { column: "reach", metric: "reach", subject: "posts" },
    { column: "interactions", metric: "interactions", subject: "posts" },
    { column: "posts", metric: "count", subject: "posts" },
  ],
  facebook: [
    { column: "followers", metric: "pageFollows", subject: "account" },
    { column: "impressions", metric: "impressions", subject: "posts" },
    { column: "interactions", metric: "postsInteractions", subject: "account" },
    { column: "posts", metric: "postsCount", subject: "account" },
  ],
  linkedin: [{ column: "followers", metric: "followers", subject: "account" }],
  twitter: [
    { column: "followers", metric: "followers" },
    { column: "impressions", metric: "impressions", subject: "posts" },
    { column: "interactions", metric: "interactions", subject: "posts" },
  ],
  tiktok: [
    { column: "followers", metric: "followers_count", subject: "account" },
    { column: "impressions", metric: "views" },
    { column: "interactions", metric: "interactions" },
  ],
  youtube: [
    { column: "followers", metric: "totalSubscribers", subject: "account" },
    { column: "impressions", metric: "views", subject: "account" },
  ],
};

const payload = z.object({
  data: z
    .array(
      z.object({
        values: z
          .array(
            z.object({ dateTime: z.string(), value: z.number().nullable() }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export type TimelinePoint = { day: string; value: number };

export type MetricoolTimelines = {
  /** Null when the network is not connected to this brand (403). */
  fetch(request: {
    blogId: string;
    network: SocialNetwork;
    metric: string;
    subject?: string;
    from: string;
    to: string;
  }): Promise<TimelinePoint[] | null>;
};

export function createMetricoolTimelines({
  apiKey,
  userId,
  fetchImpl = fetch,
}: {
  apiKey: string;
  userId: string;
  fetchImpl?: typeof fetch;
}): MetricoolTimelines {
  return {
    async fetch({ blogId, network, metric, subject, from, to }) {
      const params = new URLSearchParams({
        userId,
        blogId,
        network,
        metric,
        from: `${from}T00:00:00`,
        to: `${to}T23:59:59`,
        timezone: "UTC",
      });
      if (subject) params.set("subject", subject);
      const response = await fetchWithTimeout(
        fetchImpl,
        `${BASE}?${params}`,
        { headers: { "X-Mc-Auth": apiKey, Accept: "application/json" } },
        { label: "Metricool" },
      );
      if (response.status === 403) return null;
      const text = await response.text();
      if (!response.ok) {
        throw new Error(
          `Metricool timeline ${network}/${metric} failed with HTTP ${response.status}.`,
        );
      }
      const parsed = payload.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new Error(
          `Metricool timeline ${network}/${metric} had an unexpected shape.`,
        );
      }
      return parsed.data.data.flatMap((series) =>
        series.values.flatMap((point) =>
          point.value === null || !/^\d{4}-\d{2}-\d{2}/.test(point.dateTime)
            ? []
            : [
                {
                  day: point.dateTime.slice(0, 10),
                  value: Math.round(point.value),
                },
              ],
        ),
      );
    },
  };
}
