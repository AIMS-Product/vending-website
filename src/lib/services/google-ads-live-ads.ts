import type { GoogleAdsAd } from "@/lib/services/google-ads-dashboard";

/** An ad that can show right now, with its copy as Google shows it. */
export type LiveAd = {
  adId: string;
  campaign: string;
  adGroup: string | null;
  headlines: string[];
  descriptions: string[];
  landing: string | null;
  approval: string | null;
  inReview: boolean;
  spend: number;
  clicks: number;
  impressions: number;
};

/** An image or video asset with its spend over the sync window. */
export type DisplayCreative = {
  assetId: string;
  campaign: string;
  kind: "image" | "video";
  previewUrl: string;
  impressions: number;
  clicks: number;
  cost: number;
};

export type CopyRow = {
  adId: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
};

/**
 * Ads that can serve: enabled ad, ad group and campaign, not disapproved.
 * Copy comes from the status snapshot (every ad) and falls back to the daily
 * ad rows (ads that have served); spend is the range's.
 */
export function liveAdsOf(
  status: ReadonlyArray<Record<string, unknown>>,
  copy: ReadonlyArray<CopyRow>,
  served: readonly GoogleAdsAd[],
  enabledCampaigns: ReadonlyMap<string, string>,
  servedCopy: ReadonlyMap<string, CopyRow>,
): LiveAd[] {
  const copyById = new Map(copy.map((c) => [c.adId, c]));
  const servedById = new Map(served.map((a) => [a.adId, a]));
  return status
    .filter(
      (r) =>
        r.status === "ENABLED" &&
        r.ad_group_status === "ENABLED" &&
        enabledCampaigns.has(String(r.campaign_id)) &&
        r.approval_status !== "DISAPPROVED",
    )
    .map((r) => {
      const adId = String(r.ad_id);
      const text = copyById.get(adId) ?? servedCopy.get(adId);
      const ran = servedById.get(adId);
      return {
        adId,
        campaign: enabledCampaigns.get(String(r.campaign_id)) ?? "",
        adGroup: (r.ad_group_name as string) ?? null,
        headlines: text?.headlines ?? [],
        descriptions: text?.descriptions ?? [],
        landing: text?.finalUrls[0] ?? ran?.landing ?? null,
        approval: (r.approval_status as string) ?? null,
        inReview: r.review_status === "REVIEW_IN_PROGRESS",
        spend: ran?.spend ?? 0,
        clicks: ran?.clicks ?? 0,
        impressions: ran?.impressions ?? 0,
      };
    })
    .sort((a, b) => b.spend - a.spend || a.campaign.localeCompare(b.campaign));
}

/** Newest copy per ad from the daily ad rows. */
export function servedCopy(rows: ReadonlyArray<Record<string, unknown>>) {
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const out = new Map<string, CopyRow & { day: string }>();
  for (const r of rows) {
    const adId = String(r.ad_id);
    const day = String(r.day);
    const seen = out.get(adId);
    if (seen && seen.day >= day) continue;
    out.set(adId, {
      adId,
      day,
      headlines: strings(r.headlines),
      descriptions: strings(r.descriptions),
      finalUrls: strings(r.final_urls),
    });
  }
  return out;
}
