import "server-only";

import type { Ga4Client } from "@/lib/ga4/client";
import {
  assertion,
  compare,
  type AuditResult,
} from "@/lib/services/data-audit";
import {
  pageAll,
  type AuditClient as Client,
  type TableName,
} from "@/lib/services/data-audit-query";

/**
 * /admin/analytics/google-ads prices booked calls with the spend the Google
 * Ads script writes (`google_ads_campaign_daily`). GA4 reads the same account
 * through its Google Ads link (`advertiserAdCost`), and the two matched to the
 * cent on every settled day from 2026-09-27 to 10-09. Drift means the script
 * stopped, lost a report, or the link changed. A script that wrote nothing
 * while Google spent fails; it is never "nothing to compare".
 */
export async function googleAdsSyncSpendCheck(
  client: Client,
  ga4: Pick<Ga4Client, "fetchGoogleAdsCampaigns"> | null,
  window: { from: string; to: string; label: string },
): Promise<AuditResult[]> {
  const shared = {
    checkId: "google-ads-sync-spend",
    label: "Google Ads page spend",
    window: window.label,
    sourceName: "Google Analytics (Google Ads link)",
  };
  if (!ga4) {
    return [
      assertion({
        ...shared,
        checkId: "google-ads-sync-config",
        ok: false,
        detail:
          "GA4 is not configured, so the Google Ads script's spend was not verified.",
      }),
    ];
  }
  const campaigns = await ga4.fetchGoogleAdsCampaigns({
    startDate: window.from,
    endDate: window.to,
  });
  const source = round2(campaigns.reduce((sum, c) => sum + c.spend, 0));
  // A view, not a table; pageAll only needs a name PostgREST answers to.
  const rows = await pageAll<{ cost: number | null }>(
    client,
    "google_ads_campaign_daily" as TableName,
    "day,cost",
    (q) => q.gte("day", window.from).lte("day", window.to),
    ["day", "campaign_id"],
  );
  if (rows.length === 0 && source > 0) {
    return [
      assertion({
        ...shared,
        ok: false,
        detail: `The Google Ads script wrote no spend for these days, but Google spent $${source.toLocaleString("en-US")}. The daily script (Ads > Tools > Scripts > "VP reporting sync") has probably stopped or lost its authorization.`,
      }),
    ];
  }
  const ours = round2(rows.reduce((sum, r) => sum + Number(r.cost ?? 0), 0));
  return [
    compare({
      ...shared,
      ours,
      source,
      tolerancePct: 1,
      unit: "money",
      note: "Cost per booked call on the Google Ads page divides by this.",
    }),
  ];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
