import { z } from "zod";
import { config } from "@/lib/config";

/*
 * Meta Marketing API, read-only: one row per campaign per day from the ad
 * account's insights. Same campaign ids and figures Metricool stored (checked
 * to the cent on 2026-10-05), so rows land on the same spine keys.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_PAGES = 50;
const TIMEOUT_MS = 30_000;

export type MetaCampaignDay = {
  day: string;
  id: string;
  name: string;
  spend: number;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
};

export type MetaAdsClient = {
  fetchCampaignDays(range: {
    startDate: string;
    endDate: string;
  }): Promise<MetaCampaignDay[]>;
};

const num = z
  .string()
  .optional()
  .transform((v) => (v == null || v === "" ? null : Number(v)));

const Insights = z.object({
  data: z.array(
    z.object({
      date_start: z.string(),
      campaign_id: z.string(),
      campaign_name: z.string(),
      spend: num,
      impressions: num,
      reach: num,
      clicks: num,
    }),
  ),
  paging: z.object({ next: z.string().optional() }).optional(),
});

export function createMetaAdsClient(options: {
  accessToken: string;
  adAccountId: string;
  fetchImpl?: typeof fetch;
}): MetaAdsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const account = options.adAccountId.startsWith("act_")
    ? options.adAccountId
    : `act_${options.adAccountId}`;

  return {
    async fetchCampaignDays({ startDate, endDate }) {
      const params = new URLSearchParams({
        access_token: options.accessToken,
        level: "campaign",
        time_increment: "1",
        fields: "campaign_id,campaign_name,spend,impressions,reach,clicks",
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        limit: "500",
      });
      let url: string | undefined = `${GRAPH}/${account}/insights?${params}`;
      const rows: MetaCampaignDay[] = [];
      for (let page = 0; url && page < MAX_PAGES; page += 1) {
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await response.text();
        if (!response.ok) {
          // The body can echo the request; never log the token-bearing URL.
          throw new Error(
            `Meta insights ${response.status}: ${text.slice(0, 200)}`,
          );
        }
        const body = Insights.parse(JSON.parse(text));
        for (const r of body.data) {
          rows.push({
            day: r.date_start,
            id: r.campaign_id,
            name: r.campaign_name,
            spend: r.spend ?? 0,
            impressions: r.impressions,
            reach: r.reach,
            clicks: r.clicks,
          });
        }
        const next = body.paging?.next;
        // The next link carries the token: only follow it back to Graph.
        url =
          next && new URL(next).origin === new URL(GRAPH).origin
            ? next
            : undefined;
      }
      return rows;
    },
  };
}

export function metaAdsFromConfig(): MetaAdsClient | null {
  const accessToken = config.META_ACCESS_TOKEN;
  const adAccountId = config.META_AD_ACCOUNT_ID;
  if (!accessToken || !adAccountId) return null;
  return createMetaAdsClient({ accessToken, adAccountId });
}
